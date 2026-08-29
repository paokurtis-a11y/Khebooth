import type { AspectRatio } from '@khe/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord, LocalRenderJob } from '../offline/types';
import type { CreativePlan } from '../studio/creative-studio';
import { renderFinalMedia, type FinalMediaRenderResult } from '../studio/media-renderer';
import { planCaptureRender, renderSummary, updateCaptureRenderJob } from '../studio/render-plan';

export interface StageCaptureInput {
  eventId: string;
  sourceUri: string;
  mimeType: 'image/jpeg' | 'video/mp4';
  extension: 'jpg' | 'mp4';
  aspectRatio: AspectRatio;
  plan: CreativePlan;
  store: LocalStore;
}

export interface StagedCapture {
  localId: string;
  rawUri: string;
  byteSize: number;
  capturedAt: string;
}

export interface RenderDrainResult {
  attempted: number;
  rendered: number;
  failed: number;
  completed: Array<{ media: LocalMediaRecord; renderSummary: string; encoder: string }>;
}

type MediaRenderer = (input: Parameters<typeof renderFinalMedia>[0]) => Promise<FinalMediaRenderResult>;

function makeLocalId(): string {
  return `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function retryDelayMs(attemptCount: number): number {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, attemptCount - 1));
}

export async function stageCapture(input: StageCaptureInput): Promise<StagedCapture> {
  const localId = makeLocalId();
  const capturedAt = new Date().toISOString();
  const rawDirectory = new Directory(Paths.document, 'captures-raw', input.eventId);
  rawDirectory.create({ idempotent: true, intermediates: true });
  const source = new File(input.sourceUri);
  if (!source.exists || source.size <= 0) throw new Error('Le média brut est introuvable après la capture.');

  const raw = new File(rawDirectory, `${localId}-raw.${input.extension}`);
  source.copy(raw);
  // Android does not guarantee that File.md5 is populated immediately after a
  // native camera file is copied. The bytes are already durable at this point;
  // requiring the optional digest caused valid Samsung captures to be rejected.
  if (!raw.exists || raw.size <= 0 || raw.size !== source.size) {
    throw new Error('Le média brut n’a pas pu être sécurisé localement.');
  }

  const renderPlan = await planCaptureRender(input.eventId, localId, raw.uri, input.plan);
  const job: LocalRenderJob = {
    localId,
    eventId: input.eventId,
    sourceUri: raw.uri,
    mimeType: input.mimeType,
    extension: input.extension,
    aspectRatio: input.aspectRatio,
    capturedAt,
    state: 'CAPTURED',
    attemptCount: 0,
    nextAttemptAt: capturedAt,
    lastError: null,
    renderPlan,
    updatedAt: capturedAt,
  };
  await input.store.upsertRenderJob(job);
  return { localId, rawUri: raw.uri, byteSize: raw.size, capturedAt };
}

export class CaptureRenderQueue {
  private running = false;

  constructor(
    private readonly store: LocalStore,
    private readonly renderer: MediaRenderer = renderFinalMedia,
  ) {}

  async drain(eventId: string, now = new Date()): Promise<RenderDrainResult> {
    if (this.running) return { attempted: 0, rendered: 0, failed: 0, completed: [] };
    this.running = true;
    const result: RenderDrainResult = { attempted: 0, rendered: 0, failed: 0, completed: [] };
    try {
      await this.store.init();
      const jobs = (await this.store.listPendingRenderJobs(eventId))
        .filter((job) => new Date(job.nextAttemptAt).getTime() <= now.getTime());
      for (const job of jobs) {
        result.attempted += 1;
        try {
          const completed = await this.renderOne(job, now);
          result.rendered += 1;
          result.completed.push(completed);
        } catch (error) {
          result.failed += 1;
          await this.recordFailure(job, error, now);
        }
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  private async renderOne(job: LocalRenderJob, now: Date): Promise<RenderDrainResult['completed'][number]> {
    const renderingPlan = { ...job.renderPlan, state: 'RENDERING' as const, error: null };
    await this.store.upsertRenderJob({ ...job, state: 'RENDERING', renderPlan: renderingPlan, updatedAt: now.toISOString() });
    await updateCaptureRenderJob(job.localId, { state: 'RENDERING', error: null });

    const rendered = await this.renderer({
      eventId: job.eventId,
      localId: job.localId,
      sourceUri: job.sourceUri,
      mimeType: job.mimeType,
      aspectRatio: job.aspectRatio,
      plan: job.renderPlan.plan,
      selectedMusic: job.renderPlan.selectedMusic,
    });
    const readyAt = new Date().toISOString();
    const readyPlan = { ...renderingPlan, state: 'READY' as const, outputUri: rendered.outputUri, encoder: rendered.encoder, error: null };
    const media: LocalMediaRecord = {
      localId: job.localId,
      eventId: job.eventId,
      idempotencyKey: `${job.eventId}:${job.localId}:final`,
      contentHash: rendered.contentHash,
      byteSize: rendered.byteSize,
      mimeType: job.mimeType,
      localUri: rendered.outputUri,
      capturedAt: job.capturedAt,
      syncState: 'QUEUED',
      remoteId: null,
      uploadedBytes: 0,
      acknowledgedAt: null,
      retryCount: 0,
      lastError: null,
      updatedAt: readyAt,
    };
    await this.store.upsertMedia(media);
    await this.store.enqueue({ localId: job.localId, nextAttemptAt: readyAt, retryCount: 0, lastError: null });
    await this.store.upsertRenderJob({ ...job, state: 'READY', lastError: null, renderPlan: readyPlan, updatedAt: readyAt });
    await updateCaptureRenderJob(job.localId, { state: 'READY', outputUri: rendered.outputUri, encoder: rendered.encoder, error: null });
    return { media, renderSummary: renderSummary(readyPlan), encoder: rendered.encoder };
  }

  private async recordFailure(job: LocalRenderJob, error: unknown, now: Date): Promise<void> {
    const attemptCount = job.attemptCount + 1;
    const message = error instanceof Error ? error.message : 'Rendu final KHE impossible.';
    const nextAttemptAt = new Date(now.getTime() + retryDelayMs(attemptCount)).toISOString();
    const failedPlan = { ...job.renderPlan, state: 'FAILED' as const, error: message };
    await this.store.upsertRenderJob({
      ...job,
      state: 'FAILED',
      attemptCount,
      nextAttemptAt,
      lastError: message,
      renderPlan: failedPlan,
      updatedAt: now.toISOString(),
    });
    await updateCaptureRenderJob(job.localId, { state: 'FAILED', error: message });
  }
}
