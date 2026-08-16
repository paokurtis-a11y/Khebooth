import { File } from 'expo-file-system';
import type { LocalMediaRecord } from '../offline/types';

export interface MediaTransfer {
  transfer(
    media: LocalMediaRecord,
    uploadUrl: string,
    onProgress: (uploadedBytes: number) => Promise<void>,
  ): Promise<void>;
}

/**
 * Sends the local media bytes directly from Android/iOS to the short-lived,
 * single-object signed Blob URL. The API never receives the video/photo body.
 */
export class SignedUrlMediaTransfer implements MediaTransfer {
  async transfer(
    media: LocalMediaRecord,
    uploadUrl: string,
    onProgress: (uploadedBytes: number) => Promise<void>,
  ): Promise<void> {
    if (!uploadUrl) throw new Error('Signed upload URL is missing');

    const file = new File(media.localUri);
    if (!file.exists) throw new Error('Local media file is missing');
    if (file.size !== media.byteSize) {
      throw new Error(`Local media size changed: expected ${media.byteSize}, found ${file.size}`);
    }

    let latestQueued = 0;
    let latestReported = 0;
    let progressError: unknown = null;
    let progressChain = Promise.resolve();

    const queueProgress = (bytesSent: number): void => {
      const bounded = Math.max(0, Math.min(media.byteSize, Math.floor(bytesSent)));
      if (bounded <= latestQueued) return;
      latestQueued = bounded;
      progressChain = progressChain
        .then(async () => {
          if (bounded <= latestReported) return;
          await onProgress(bounded);
          latestReported = bounded;
        })
        .catch((error) => {
          progressError ??= error;
        });
    };

    const task = file.createUploadTask(uploadUrl, {
      httpMethod: 'PUT',
      mimeType: media.mimeType,
      headers: { 'Content-Type': media.mimeType },
      onProgress: ({ bytesSent }) => queueProgress(bytesSent),
    });

    const result = await task.uploadAsync();
    await progressChain;
    if (progressError) throw progressError;
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(`Cloud upload failed with HTTP ${result?.status ?? 'unknown'}`);
    }

    if (latestReported < media.byteSize) await onProgress(media.byteSize);
  }
}
