import * as Network from 'expo-network';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import type { StationApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import type { CredentialVault } from '../security/credential-vault';
import { shouldRecoverFromAppState, shouldRecoverFromNetwork } from '../station/recovery-trigger';
import { respondSharingConnection } from '../station/sharing-connection-client';
import { SignedUrlMediaTransfer } from './media-transfer';
import { SyncEngine } from './sync-engine';

const SYNC_INTERVAL_MS = 2_000;
const CONNECTION_POLL_INTERVAL_MS = 1_200;

export function useCaptureSync(
  api: StationApi,
  store: LocalStore,
  vault: CredentialVault,
  enabled: boolean,
): void {
  const transfer = useMemo(() => new SignedUrlMediaTransfer(), []);
  const syncEngine = useMemo(() => new SyncEngine(api, store, vault, transfer), [api, store, transfer, vault]);
  const runningRef = useRef(false);
  const connectionPollRef = useRef(false);
  const promptedRequestRef = useRef('');

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

    const recoverNow = () => {
      if (!cancelled) void drain();
    };

    void drain();
    const timer = setInterval(recoverNow, SYNC_INTERVAL_MS);
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (shouldRecoverFromNetwork(state)) recoverNow();
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (shouldRecoverFromAppState(state)) recoverNow();
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [enabled, syncEngine]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const answer = async (accepted: boolean) => {
      try {
        const latestToken = await vault.getStationToken();
        if (!latestToken) throw new Error('Session CAPTURE introuvable');
        await respondSharingConnection(latestToken, accepted);
      } catch {
        promptedRequestRef.current = '';
        if (!cancelled) {
          Alert.alert('Connexion SHARING', 'La réponse n’a pas pu être envoyée. La demande sera reproposée automatiquement.');
        }
      }
    };

    const pollConnectionRequest = async () => {
      if (cancelled || connectionPollRef.current) return;
      connectionPollRef.current = true;
      try {
        const stationToken = await vault.getStationToken();
        if (!stationToken) return;
        // This status update is also CAPTURE's heartbeat. It keeps SHARING aware that
        // the capture tablet is really online even when the camera screen is not open.
        const control = await api.updateControlStatus(stationToken, {});
        if (cancelled || control.sharingConnectionStatus !== 'PENDING') return;

        const requestKey = String(control.sharingRequestedAt ?? 'pending-request');
        if (promptedRequestRef.current === requestKey) return;
        promptedRequestRef.current = requestKey;

        Alert.alert(
          'Connexion SHARING',
          'La station SHARING demande à se connecter à CAPTURE pour la régie à distance et l’aperçu live. Autoriser cette connexion ?',
          [
            { text: 'Refuser', style: 'destructive', onPress: () => void answer(false) },
            { text: 'Accepter', onPress: () => void answer(true) },
          ],
          { cancelable: false },
        );
      } catch {
        // Offline-first: CAPTURE continue de fonctionner et retentera la demande plus tard.
      } finally {
        connectionPollRef.current = false;
      }
    };

    const recoverConnectionNow = () => {
      if (!cancelled) void pollConnectionRequest();
    };

    void pollConnectionRequest();
    const timer = setInterval(recoverConnectionNow, CONNECTION_POLL_INTERVAL_MS);
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (shouldRecoverFromNetwork(state)) recoverConnectionNow();
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (shouldRecoverFromAppState(state)) recoverConnectionNow();
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [api, enabled, vault]);
}
