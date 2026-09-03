import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import type { LocalStore } from '../offline/local-store';
import { CaptureProcessingService } from './capture-processing';
import { createLazyFinalMediaRenderer } from './lazy-media-renderer';

const PROCESS_INTERVAL_MS = 750;

export function useCaptureProcessing(store: LocalStore, eventId: string | null, enabled: boolean): void {
  const renderer = useMemo(() => createLazyFinalMediaRenderer(), []);
  const service = useMemo(() => new CaptureProcessingService(store, renderer), [renderer, store]);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled || !eventId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (cancelled || runningRef.current) return;
      runningRef.current = true;
      try {
        await service.drain(eventId);
      } finally {
        runningRef.current = false;
        if (!cancelled) timer = setTimeout(() => void run(), PROCESS_INTERVAL_MS);
      }
    };

    void run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [enabled, eventId, service]);
}
