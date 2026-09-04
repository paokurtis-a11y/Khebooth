import type { LocalStore } from '../offline/local-store';
import type { CapturePipelineRecord } from '../offline/types';

export function canDeleteRawCapture(capture: CapturePipelineRecord): boolean {
  return capture.processingState === 'READY' || capture.processingState === 'FAILED';
}

export async function deleteRawCapture(
  store: LocalStore,
  capture: CapturePipelineRecord,
  deleteLocalFile: (uri: string) => void | Promise<void>,
): Promise<void> {
  if (!canDeleteRawCapture(capture)) {
    throw new Error('Attendez la fin du traitement Studio avant de supprimer ce fichier brut.');
  }
  await deleteLocalFile(capture.rawUri);
  await store.deleteCapture(capture.localId);
}
