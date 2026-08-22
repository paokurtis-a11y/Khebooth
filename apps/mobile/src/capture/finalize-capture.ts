import type { AspectRatio } from '@khe/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';
import type { CreativePlan } from '../studio/creative-studio';
import { renderFinalMedia } from '../studio/media-renderer';
import { planCaptureRender, renderSummary, updateCaptureRenderJob } from '../studio/render-plan';

export interface FinalizeCaptureInput {
  eventId: string;
  sourceUri: string;
  mimeType: 'image/jpeg' | 'video/mp4';
  extension: 'jpg' | 'mp4';
  aspectRatio: AspectRatio;
  plan: CreativePlan;
  store: LocalStore;
}

export interface FinalizedCapture {
  media: LocalMediaRecord;
  rawUri: string;
  renderSummary: string;
  encoder: string;
}

function makeLocalId() {
  return `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function finalizeCapture(input: FinalizeCaptureInput): Promise<FinalizedCapture> {
  const localId = makeLocalId();
  const capturedAt = new Date().toISOString();
  const rawDirectory = new Directory(Paths.document, 'captures-raw', input.eventId);
  rawDirectory.create({ idempotent: true, intermediates: true });
  const source = new File(input.sourceUri);
  if (!source.exists || source.size <= 0) throw new Error('Le média brut est introuvable après la capture.');
  const raw = new File(rawDirectory, `${localId}-raw.${input.extension}`);
  source.copy(raw);
  if (!raw.exists || raw.size <= 0 || !raw.md5) throw new Error('Le média brut n’a pas pu être sécurisé localement.');

  const renderJob = await planCaptureRender(input.eventId, localId, raw.uri, input.plan);
  await updateCaptureRenderJob(localId, { state: 'RENDERING', error: null });

  try {
    const rendered = await renderFinalMedia({
      eventId: input.eventId,
      localId,
      sourceUri: raw.uri,
      mimeType: input.mimeType,
      aspectRatio: input.aspectRatio,
      plan: input.plan,
      selectedMusic: renderJob.selectedMusic,
    });
    await updateCaptureRenderJob(localId, { state: 'READY', outputUri: rendered.outputUri, encoder: rendered.encoder, error: null });

    const media: LocalMediaRecord = {
      localId,
      eventId: input.eventId,
      idempotencyKey: `${input.eventId}:${localId}`,
      contentHash: rendered.contentHash,
      byteSize: rendered.byteSize,
      mimeType: input.mimeType,
      localUri: rendered.outputUri,
      capturedAt,
      syncState: 'QUEUED',
      remoteId: null,
      uploadedBytes: 0,
      acknowledgedAt: null,
      retryCount: 0,
      lastError: null,
      updatedAt: capturedAt,
    };
    await input.store.upsertMedia(media);
    await input.store.enqueue({ localId, nextAttemptAt: capturedAt, retryCount: 0, lastError: null });
    return { media, rawUri: raw.uri, renderSummary: renderSummary(renderJob), encoder: rendered.encoder };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rendu final KHE impossible.';
    await updateCaptureRenderJob(localId, { state: 'FAILED', error: message });
    throw new Error(`${message} L’original brut reste conservé sur cette tablette : ${raw.uri}`);
  }
}
