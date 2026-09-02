import type { LocalStore } from '../offline/local-store';
import type { CapturePipelineRecord, LocalMediaRecord } from '../offline/types';
import type { FinalMediaRenderInput, FinalMediaRenderResult } from './media-renderer';

export type CaptureRenderFunction = (input: FinalMediaRenderInput) => Promise<FinalMediaRenderResult>;

export interface CaptureProcessingResult {
  attempted: number;
  ready: number;
  failed: number;
}

const STALE_RENDER_MS = 30_000;

export function captureIsProcessable(capture: CapturePipelineRecord, now: Date): boolean {
  if (capture.processingState === 'READY') return false;
  if (capture.processingState === 'RENDERING') {
    return new Date(capture.updatedAt).getTime() <= now.getTime() - STALE_RENDER_MS;
  }
  return new Date(capture.nextAttemptAt).getTime() <= now.getTime();
}

export class CaptureProcessingService {
  constructor(
    private readonly store: LocalStore,
    private readonly render: CaptureRenderFunction,
  ) {}

  async drain(eventId: string, now = new Date()): Promise<CaptureProcessingResult> {
    await this.store.init();
    const next = (await this.store.listCaptures(eventId))
      .filter((capture) => captureIsProcessable(capture, now))
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))[0];
    if (!next) return { attempted: 0, ready: 0, failed: 0 };
    try {
      await this.processOne(next.localId, now);
      return { attempted: 1, ready: 1, failed: 0 };
    } catch {
      return { attempted: 1, ready: 0, failed: 1 };
    }
  }

  async processOne(localId: string, now = new Date()): Promise<LocalMediaRecord> {
    const capture = await this.store.getCapture(localId);
    if (!capture) throw new Error(`Capture brute ${localId} introuvable.`);

    const existing = await this.store.getMedia(localId);
    if (existing) {
      if (existing.syncState !== 'SYNCED') {
        await this.store.enqueue({ localId, nextAttemptAt: now.toISOString(), retryCount: existing.retryCount, lastError: existing.lastError });
      }
      await this.store.upsertCapture({
        ...capture,
        processingState: 'READY',
        finalUri: existing.localUri,
        finalContentHash: existing.contentHash,
        finalByteSize: existing.byteSize,
        lastError: null,
        nextAttemptAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      return existing;
    }

    const rendering: CapturePipelineRecord = {
      ...capture,
      processingState: 'RENDERING',
      lastError: null,
      updatedAt: now.toISOString(),
    };
    await this.store.upsertCapture(rendering);

    try {
      const plan = JSON.parse(rendering.renderPlanJson) as FinalMediaRenderInput['plan'];
      const selectedMusic = rendering.selectedMusicJson
        ? JSON.parse(rendering.selectedMusicJson) as FinalMediaRenderInput['selectedMusic']
        : null;
      const rendered = await this.render({
        eventId: rendering.eventId,
        localId: rendering.localId,
        sourceUri: rendering.rawUri,
        mimeType: rendering.mimeType,
        aspectRatio: rendering.aspectRatio,
        plan,
        selectedMusic,
      });
      const completedAt = new Date().toISOString();
      const media: LocalMediaRecord = {
        localId: rendering.localId,
        eventId: rendering.eventId,
        idempotencyKey: `${rendering.eventId}:${rendering.localId}:final-v1`,
        contentHash: rendered.contentHash,
        byteSize: rendered.byteSize,
        mimeType: rendering.mimeType,
        localUri: rendered.outputUri,
        capturedAt: rendering.capturedAt,
        syncState: 'QUEUED',
        remoteId: null,
        uploadedBytes: 0,
        acknowledgedAt: null,
        retryCount: 0,
        lastError: null,
        updatedAt: completedAt,
      };
      await this.store.upsertMedia(media);
      await this.store.enqueue({ localId: media.localId, nextAttemptAt: completedAt, retryCount: 0, lastError: null });
      await this.store.upsertCapture({
        ...rendering,
        processingState: 'READY',
        finalUri: rendered.outputUri,
        finalContentHash: rendered.contentHash,
        finalByteSize: rendered.byteSize,
        encoder: rendered.encoder,
        retryCount: 0,
        lastError: null,
        nextAttemptAt: completedAt,
        updatedAt: completedAt,
      });
      return media;
    } catch (error) {
      const retryCount = rendering.retryCount + 1;
      const message = error instanceof Error ? error.message : 'Rendu final KHE impossible.';
      const delayMs = Math.min(60_000, 1_000 * 2 ** Math.min(retryCount - 1, 6));
      await this.store.upsertCapture({
        ...rendering,
        processingState: 'FAILED',
        retryCount,
        lastError: message,
        nextAttemptAt: new Date(now.getTime() + delayMs).toISOString(),
        updatedAt: now.toISOString(),
      });
      throw new Error(`${message} Le fichier brut reste conservé.`);
    }
  }
}

export async function rescheduleCaptureProcessing(store: LocalStore, localId: string): Promise<boolean> {
  const capture = await store.getCapture(localId);
  if (!capture || capture.processingState === 'READY') return false;
  const now = new Date().toISOString();
  await store.upsertCapture({ ...capture, processingState: 'QUEUED', lastError: null, nextAttemptAt: now, updatedAt: now });
  return true;
}
