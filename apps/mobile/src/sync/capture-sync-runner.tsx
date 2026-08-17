import { useEffect, useMemo, useRef } from 'react';
import type { StationApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import type { CredentialVault } from '../security/credential-vault';
import { SignedUrlMediaTransfer } from './media-transfer';
import { SyncEngine } from './sync-engine';

interface CaptureSyncRunnerProps {
  api: StationApi;
  store: LocalStore;
  vault: CredentialVault;
  enabled: boolean;
}

const SYNC_INTERVAL_MS = 5_000;

export function CaptureSyncRunner({ api, store, vault, enabled }: CaptureSyncRunnerProps) {
  const transfer = useMemo(() => new SignedUrlMediaTransfer(), []);
  const syncEngine = useMemo(() => new SyncEngine(api, store, vault, transfer), [api, store, transfer, vault]);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const drain = async () => {
      if (cancelled || runningRef.current) return;
      runningRef.current = true;
      try {
        await syncEngine.drain();
      } catch {
        // Offline-first: queued media and local files remain intact for the next retry.
      } finally {
        runningRef.current = false;
      }
    };

    void drain();
    const timer = setInterval(() => void drain(), SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, syncEngine]);

  return null;
}
