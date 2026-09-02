import type { AspectRatio } from '@khe/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import type { LocalStore } from '../offline/local-store';
import type { CapturePipelineRecord } from '../offline/types';
import type { CreativePlan } from '../studio/creative-studio';
import { planCaptureRender, renderSummary } from '../studio/render-plan';

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
  capture: CapturePipelineRecord;
  rawUri: string;
  renderSummary: string;
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
  const summary = renderSummary(renderJob);
  const capture: CapturePipelineRecord = {
    localId,
    eventId: input.eventId,
    rawUri: raw.uri,
    rawContentHash: raw.md5,
    rawByteSize: raw.size,
    mimeType: input.mimeType,
    extension: input.extension,
    aspectRatio: input.aspectRatio,
    capturedAt,
    processingState: 'QUEUED',
    renderPlanJson: JSON.stringify(renderJob.plan),
    selectedMusicJson: renderJob.selectedMusic ? JSON.stringify(renderJob.selectedMusic) : null,
    renderSummary: summary,
    finalUri: null,
    finalContentHash: null,
    finalByteSize: null,
    encoder: null,
    retryCount: 0,
    lastError: null,
    nextAttemptAt: capturedAt,
    updatedAt: capturedAt,
  };
  await input.store.upsertCapture(capture);
  return { capture, rawUri: raw.uri, renderSummary: summary };
}
