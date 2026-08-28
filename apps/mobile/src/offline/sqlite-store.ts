import type { EventManifestContract } from '@khe/contracts';
import * as SQLite from 'expo-sqlite';
import type { LocalStore } from './local-store';
import { isDeadSQLiteNativeHandle, openInitializedSQLiteDatabase } from './sqlite-connection';
import type {
  LocalMediaRecord,
  LocalRenderJob,
  OfflineSnapshot,
  PersistedStationContext,
  SharedMediaRecord,
  SyncQueueItem,
} from './types';

type JsonRow = { value: string };
type MediaRow = LocalMediaRecord;
type QueueRow = SyncQueueItem;
type SharedMediaRow = SharedMediaRecord;
type RenderJobRow = Omit<LocalRenderJob, 'renderPlan'> & { renderPlanJson: string };

function deserializeRenderJob(row: RenderJobRow): LocalRenderJob {
  const { renderPlanJson, ...job } = row;
  return { ...job, renderPlan: JSON.parse(renderPlanJson) as LocalRenderJob['renderPlan'] };
}

const DATABASE_SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS manifests (
    eventId TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS local_media (
    localId TEXT PRIMARY KEY NOT NULL,
    eventId TEXT NOT NULL,
    idempotencyKey TEXT NOT NULL UNIQUE,
    contentHash TEXT NOT NULL,
    byteSize INTEGER NOT NULL,
    mimeType TEXT NOT NULL,
    localUri TEXT NOT NULL,
    capturedAt TEXT NOT NULL,
    syncState TEXT NOT NULL,
    remoteId TEXT,
    uploadedBytes INTEGER NOT NULL DEFAULT 0,
    acknowledgedAt TEXT,
    retryCount INTEGER NOT NULL DEFAULT 0,
    lastError TEXT,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS local_media_event_sync_idx ON local_media(eventId, syncState);
  CREATE TABLE IF NOT EXISTS sync_queue (
    localId TEXT PRIMARY KEY NOT NULL,
    nextAttemptAt TEXT NOT NULL,
    retryCount INTEGER NOT NULL DEFAULT 0,
    lastError TEXT,
    FOREIGN KEY(localId) REFERENCES local_media(localId) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS render_jobs (
    localId TEXT PRIMARY KEY NOT NULL,
    eventId TEXT NOT NULL,
    sourceUri TEXT NOT NULL,
    mimeType TEXT NOT NULL,
    extension TEXT NOT NULL,
    aspectRatio TEXT NOT NULL,
    capturedAt TEXT NOT NULL,
    state TEXT NOT NULL,
    attemptCount INTEGER NOT NULL DEFAULT 0,
    nextAttemptAt TEXT NOT NULL,
    lastError TEXT,
    renderPlanJson TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS render_jobs_event_state_idx ON render_jobs(eventId, state, nextAttemptAt);
  CREATE TABLE IF NOT EXISTS shared_media (
    id TEXT PRIMARY KEY NOT NULL,
    eventId TEXT NOT NULL,
    localId TEXT NOT NULL,
    contentHash TEXT NOT NULL,
    byteSize INTEGER NOT NULL,
    mimeType TEXT NOT NULL,
    capturedAt TEXT,
    acknowledgedAt TEXT NOT NULL,
    cachedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS shared_media_event_idx ON shared_media(eventId, acknowledgedAt);
`;

export class SQLiteLocalStore implements LocalStore {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private recoveryPromise: Promise<void> | null = null;

  constructor(private readonly databaseName = 'khe-booth.db') {}

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const db = await openInitializedSQLiteDatabase(
        (name, options) => SQLite.openDatabaseAsync(name, options),
        this.databaseName,
        DATABASE_SCHEMA,
      );
      this.db = db;
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async database(): Promise<SQLite.SQLiteDatabase> {
    await this.init();
    if (!this.db) throw new Error('SQLite database unavailable');
    return this.db;
  }

  private isRecoverableNativeError(error: unknown): boolean {
    return isDeadSQLiteNativeHandle(error);
  }

  private async resetDatabase(): Promise<void> {
    if (this.recoveryPromise) return this.recoveryPromise;
    // Do not close a poisoned native handle: expo-sqlite's Android regression
    // can double-close it during runtime teardown. Detach it and open a truly
    // new connection instead.
    this.recoveryPromise = (async () => {
      this.db = null;
      this.initPromise = null;
      await this.init();
    })();
    try {
      await this.recoveryPromise;
    } finally {
      this.recoveryPromise = null;
    }
  }

  private async withNativeRecovery<T>(operation: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
    try {
      return await operation(await this.database());
    } catch (error) {
      if (!this.isRecoverableNativeError(error)) throw error;
      await this.resetDatabase();
      return operation(await this.database());
    }
  }

  async saveStation(context: PersistedStationContext): Promise<void> {
    await this.withNativeRecovery(async (db) => {
      await db.runAsync(
        `INSERT INTO app_state(key, value, updatedAt) VALUES('station', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        JSON.stringify(context),
        new Date().toISOString(),
      );
    });
  }

  async getStation(): Promise<PersistedStationContext | null> {
    return this.withNativeRecovery(async (db) => {
      const row = await db.getFirstAsync<JsonRow>("SELECT value FROM app_state WHERE key = 'station'");
      return row ? (JSON.parse(row.value) as PersistedStationContext) : null;
    });
  }

  async clearStation(): Promise<void> {
    await this.withNativeRecovery(async (db) => {
      await db.runAsync("DELETE FROM app_state WHERE key = 'station'");
    });
  }

  async saveManifest(eventId: string, manifest: EventManifestContract): Promise<void> {
    await this.withNativeRecovery(async (db) => {
      await db.runAsync(
        `INSERT INTO manifests(eventId, value, updatedAt) VALUES(?, ?, ?)
         ON CONFLICT(eventId) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        eventId,
        JSON.stringify(manifest),
        new Date().toISOString(),
      );
    });
  }

  async getManifest(eventId: string): Promise<EventManifestContract | null> {
    return this.withNativeRecovery(async (db) => {
      const row = await db.getFirstAsync<JsonRow>('SELECT value FROM manifests WHERE eventId = ?', eventId);
      return row ? (JSON.parse(row.value) as EventManifestContract) : null;
    });
  }

  async upsertMedia(media: LocalMediaRecord): Promise<void> {
    await this.withNativeRecovery(async (db) => {
      await db.runAsync(
      `INSERT INTO local_media(
        localId,eventId,idempotencyKey,contentHash,byteSize,mimeType,localUri,capturedAt,
        syncState,remoteId,uploadedBytes,acknowledgedAt,retryCount,lastError,updatedAt
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(localId) DO UPDATE SET
        eventId=excluded.eventId,
        idempotencyKey=excluded.idempotencyKey,
        contentHash=excluded.contentHash,
        byteSize=excluded.byteSize,
        mimeType=excluded.mimeType,
        localUri=excluded.localUri,
        capturedAt=excluded.capturedAt,
        syncState=excluded.syncState,
        remoteId=excluded.remoteId,
        uploadedBytes=excluded.uploadedBytes,
        acknowledgedAt=excluded.acknowledgedAt,
        retryCount=excluded.retryCount,
        lastError=excluded.lastError,
        updatedAt=excluded.updatedAt`,
      media.localId,
      media.eventId,
      media.idempotencyKey,
      media.contentHash,
      media.byteSize,
      media.mimeType,
      media.localUri,
      media.capturedAt,
      media.syncState,
      media.remoteId,
      media.uploadedBytes,
      media.acknowledgedAt,
      media.retryCount,
      media.lastError,
        media.updatedAt,
      );
    });
  }

  async getMedia(localId: string): Promise<LocalMediaRecord | null> {
    return this.withNativeRecovery(async (db) =>
      (await db.getFirstAsync<MediaRow>('SELECT * FROM local_media WHERE localId = ?', localId)) ?? null,
    );
  }

  async listMedia(eventId: string): Promise<LocalMediaRecord[]> {
    return this.withNativeRecovery(async (db) =>
      db.getAllAsync<MediaRow>(
        'SELECT * FROM local_media WHERE eventId = ? ORDER BY capturedAt DESC',
        eventId,
      ),
    );
  }

  async listPendingMedia(eventId: string): Promise<LocalMediaRecord[]> {
    return this.withNativeRecovery(async (db) =>
      db.getAllAsync<MediaRow>(
        "SELECT * FROM local_media WHERE eventId = ? AND syncState <> 'SYNCED' ORDER BY capturedAt ASC",
        eventId,
      ),
    );
  }

  async deleteMedia(localId: string): Promise<void> {
    await this.withNativeRecovery(async (db) => {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM sync_queue WHERE localId = ?', localId);
        await db.runAsync('DELETE FROM local_media WHERE localId = ?', localId);
      });
    });
  }

  async enqueue(item: SyncQueueItem): Promise<void> {
    await this.withNativeRecovery(async (db) => {
      await db.runAsync(
      `INSERT INTO sync_queue(localId,nextAttemptAt,retryCount,lastError) VALUES(?,?,?,?)
       ON CONFLICT(localId) DO UPDATE SET
         nextAttemptAt=excluded.nextAttemptAt,
         retryCount=excluded.retryCount,
         lastError=excluded.lastError`,
      item.localId,
      item.nextAttemptAt,
      item.retryCount,
        item.lastError,
      );
    });
  }

  async listQueue(): Promise<SyncQueueItem[]> {
    return this.withNativeRecovery(async (db) =>
      db.getAllAsync<QueueRow>('SELECT * FROM sync_queue ORDER BY nextAttemptAt ASC'),
    );
  }

  async removeQueueItem(localId: string): Promise<void> {
    await this.withNativeRecovery(async (db) => {
      await db.runAsync('DELETE FROM sync_queue WHERE localId = ?', localId);
    });
  }

  async upsertRenderJob(job: LocalRenderJob): Promise<void> {
    await this.withNativeRecovery(async (db) => {
      await db.runAsync(
        `INSERT INTO render_jobs(
          localId,eventId,sourceUri,mimeType,extension,aspectRatio,capturedAt,state,
          attemptCount,nextAttemptAt,lastError,renderPlanJson,updatedAt
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(localId) DO UPDATE SET
          eventId=excluded.eventId,
          sourceUri=excluded.sourceUri,
          mimeType=excluded.mimeType,
          extension=excluded.extension,
          aspectRatio=excluded.aspectRatio,
          capturedAt=excluded.capturedAt,
          state=excluded.state,
          attemptCount=excluded.attemptCount,
          nextAttemptAt=excluded.nextAttemptAt,
          lastError=excluded.lastError,
          renderPlanJson=excluded.renderPlanJson,
          updatedAt=excluded.updatedAt`,
        job.localId,
        job.eventId,
        job.sourceUri,
        job.mimeType,
        job.extension,
        job.aspectRatio,
        job.capturedAt,
        job.state,
        job.attemptCount,
        job.nextAttemptAt,
        job.lastError,
        JSON.stringify(job.renderPlan),
        job.updatedAt,
      );
    });
  }

  async getRenderJob(localId: string): Promise<LocalRenderJob | null> {
    return this.withNativeRecovery(async (db) => {
      const row = await db.getFirstAsync<RenderJobRow>('SELECT * FROM render_jobs WHERE localId = ?', localId);
      return row ? deserializeRenderJob(row) : null;
    });
  }

  async listRenderJobs(eventId: string): Promise<LocalRenderJob[]> {
    return this.withNativeRecovery(async (db) => {
      const rows = await db.getAllAsync<RenderJobRow>(
        'SELECT * FROM render_jobs WHERE eventId = ? ORDER BY capturedAt DESC',
        eventId,
      );
      return rows.map(deserializeRenderJob);
    });
  }

  async listPendingRenderJobs(eventId: string): Promise<LocalRenderJob[]> {
    return this.withNativeRecovery(async (db) => {
      const rows = await db.getAllAsync<RenderJobRow>(
        "SELECT * FROM render_jobs WHERE eventId = ? AND state <> 'READY' ORDER BY capturedAt ASC",
        eventId,
      );
      return rows.map(deserializeRenderJob);
    });
  }

  async replaceSharedMedia(eventId: string, media: SharedMediaRecord[]): Promise<void> {
    await this.withNativeRecovery(async (db) => {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM shared_media WHERE eventId = ?', eventId);
        for (const item of media) {
          await db.runAsync(
          `INSERT INTO shared_media(id,eventId,localId,contentHash,byteSize,mimeType,capturedAt,acknowledgedAt,cachedAt)
           VALUES(?,?,?,?,?,?,?,?,?)`,
          item.id,
          item.eventId,
          item.localId,
          item.contentHash,
          item.byteSize,
          item.mimeType,
          item.capturedAt,
          item.acknowledgedAt,
            item.cachedAt,
          );
        }
      });
    });
  }

  async listSharedMedia(eventId: string): Promise<SharedMediaRecord[]> {
    return this.withNativeRecovery(async (db) =>
      db.getAllAsync<SharedMediaRow>(
        'SELECT * FROM shared_media WHERE eventId = ? ORDER BY acknowledgedAt ASC',
        eventId,
      ),
    );
  }

  async snapshot(eventId: string): Promise<OfflineSnapshot> {
    return {
      station: await this.getStation(),
      manifest: await this.getManifest(eventId),
      pendingMedia: await this.listPendingMedia(eventId),
      queue: await this.listQueue(),
      sharedMedia: await this.listSharedMedia(eventId),
      renderJobs: await this.listRenderJobs(eventId),
    };
  }
}
