import { useEffect, useMemo, useState } from 'react';
import type { LocalStore } from '../offline/local-store';
import { CaptureRenderQueue } from './finalize-capture';

export interface CaptureRenderQueueStatus {
  processing: boolean;
  pending: number;
  failed: number;
  ready: number;
  lastCompletedId: string | null;
  lastError: string | null;
}

const EMPTY_STATUS: CaptureRenderQueueStatus = {
  processing: false,
  pending: 0,
  failed: 0,
  ready: 0,
  lastCompletedId: null,
  lastError: null,
};

export function useCaptureRenderQueue(store: LocalStore, eventId: string | null, enabled: boolean): CaptureRenderQueueStatus {
  const queue = useMemo(() => new CaptureRenderQueue(store), [store]);
  const [status, setStatus] = useState<CaptureRenderQueueStatus>(EMPTY_STATUS);

  useEffect(() => {
    if (!enabled || !eventId) {
      setStatus(EMPTY_STATUS);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async (): Promise<void> => {
      try {
        const before = await store.listRenderJobs(eventId);
        if (!cancelled) {
          setStatus((current) => ({
            ...current,
            processing: before.some((job) => job.state === 'CAPTURED' || job.state === 'RENDERING'),
            pending: before.filter((job) => job.state === 'CAPTURED' || job.state === 'RENDERING').length,
            failed: before.filter((job) => job.state === 'FAILED').length,
            ready: before.filter((job) => job.state === 'READY').length,
          }));
        }
        const result = await queue.drain(eventId);
        const after = await store.listRenderJobs(eventId);
        if (!cancelled) {
          setStatus({
            processing: after.some((job) => job.state === 'CAPTURED' || job.state === 'RENDERING'),
            pending: after.filter((job) => job.state === 'CAPTURED' || job.state === 'RENDERING').length,
            failed: after.filter((job) => job.state === 'FAILED').length,
            ready: after.filter((job) => job.state === 'READY').length,
            lastCompletedId: result.completed.at(-1)?.media.localId ?? null,
            lastError: after.find((job) => job.state === 'FAILED')?.lastError ?? null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setStatus((current) => ({ ...current, processing: false, lastError: error instanceof Error ? error.message : 'File de rendu Studio indisponible.' }));
        }
      } finally {
        if (!cancelled) timer = setTimeout(() => void run(), 800);
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, eventId, queue, store]);

  return status;
}
