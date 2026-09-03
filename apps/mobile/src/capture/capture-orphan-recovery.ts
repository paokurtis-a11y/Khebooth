import type { AspectRatio } from '@khe/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import type { LocalStore } from '../offline/local-store';
import type { CapturePipelineRecord } from '../offline/types';
import type { CreativePlan } from '../studio/creative-studio';
import { planCaptureRender, renderSummary } from '../studio/render-plan';

const RAW_FILE_PATTERN = /^(media-[a-z0-9]+-[a-z0-9]+)-raw\.(jpg|mp4)$/i;

function capturedAtFor(file: File, localId: string): string {
  const fileTime = file.creationTime ?? file.lastModified;
  if (typeof fileTime === 'number' && Number.isFinite(fileTime) && fileTime > 0) {
    return new Date(fileTime).toISOString();
  }
  const encoded = localId.split('-')[1];
  const timestamp = encoded ? Number.parseInt(encoded, 36) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toISOString() : new Date().toISOString();
}

/**
 * Version 0.3.7 could finish the native copy after the JavaScript verification
 * had already failed. Rebuild the missing SQLite rows so those originals are
 * not lost and can continue through Studio after the application is updated.
 */
export async function recoverOrphanedRawCaptures(
  eventId: string,
  store: LocalStore,
  plan: CreativePlan,
  aspectRatio: AspectRatio = '9:16',
): Promise<number> {
  const directory = new Directory(Paths.document, 'captures-raw', eventId);
  if (!directory.exists) return 0;

  let recovered = 0;
  for (const entry of directory.list()) {
    if (!(entry instanceof File)) continue;
    const match = RAW_FILE_PATTERN.exec(entry.name);
    if (!match) continue;
    const localId = match[1];
    const extension = match[2].toLowerCase() as 'jpg' | 'mp4';
    if (await store.getCapture(localId)) continue;

    const byteSize = entry.size ?? 0;
    const contentHash = entry.md5;
    if (!entry.exists || byteSize <= 0 || !contentHash) continue;

    const renderJob = await planCaptureRender(eventId, localId, entry.uri, plan);
    const capturedAt = capturedAtFor(entry, localId);
    const capture: CapturePipelineRecord = {
      localId,
      eventId,
      rawUri: entry.uri,
      rawContentHash: contentHash,
      rawByteSize: byteSize,
      mimeType: extension === 'jpg' ? 'image/jpeg' : 'video/mp4',
      extension,
      aspectRatio,
      capturedAt,
      processingState: 'QUEUED',
      renderPlanJson: JSON.stringify(renderJob.plan),
      selectedMusicJson: renderJob.selectedMusic ? JSON.stringify(renderJob.selectedMusic) : null,
      renderSummary: renderSummary(renderJob),
      finalUri: null,
      finalContentHash: null,
      finalByteSize: null,
      encoder: null,
      retryCount: 0,
      lastError: null,
      nextAttemptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.upsertCapture(capture);
    recovered += 1;
  }

  if (recovered > 0) console.info('[capture:recovery] orphaned raw media restored', { eventId, recovered });
  return recovered;
}
