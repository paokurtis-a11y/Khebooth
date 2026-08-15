import type { LocalMediaRecord } from '../offline/types';

export interface MediaTransfer {
  transfer(
    media: LocalMediaRecord,
    resumeFrom: number,
    onProgress: (uploadedBytes: number) => Promise<void>,
  ): Promise<void>;
}

/**
 * Phase 2 synthetic transfer. It exercises the durable resume protocol without
 * uploading camera bytes. Real object-storage transfer replaces this only after
 * the capture gate is green.
 */
export class SyntheticMediaTransfer implements MediaTransfer {
  async transfer(
    media: LocalMediaRecord,
    resumeFrom: number,
    onProgress: (uploadedBytes: number) => Promise<void>,
  ): Promise<void> {
    if (resumeFrom < 0 || resumeFrom > media.byteSize) {
      throw new Error('Invalid resume checkpoint');
    }
    if (resumeFrom === media.byteSize) return;
    await onProgress(media.byteSize);
  }
}
