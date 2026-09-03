import * as Network from 'expo-network';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import type { StationApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import type { CredentialVault } from '../security/credential-vault';
import { DEFAULT_APP_SETTINGS, confirmNetworkTransferIfNeeded, loadAppSettings, type AppSettings } from '../settings/app-settings';
import { evaluateSyncNetwork, shouldImmediateReconnect } from '../settings/network-policy';
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
  const settingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const cellularApprovedRef = useRef(false);
  const cellularDeniedRef = useRef(false);
  const lastNetworkTypeRef = useRef<Network.NetworkStateType | null>(null);

  const refreshSettings = async () => {
    try { settingsRef.current = await loadAppSettings(); } catch { settingsRef.current = DEFAULT_APP_SETTINGS; }
    return settingsRef.current;
  };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const drain = async () => {
      if (cancelled || runningRef.current) return;
      runningRef.current = true;
      try {
        await store.init();
        const pending = await store.listQueue();
        if (pending.length === 0) return;

        const settings = await refreshSettings();
        const state = await Network.getNetworkStateAsync();
        const decision = evaluateSyncNetwork(settings, state, cellularApprovedRef.current);
        if (decision === 'OFFLINE' || decision === 'WAIT_FOR_WIFI') return;
        if (decision === 'PROMPT_CELLULAR') {
          if (cellularDeniedRef.current) return;
          const approved = await confirmNetworkTransferIfNeeded(settings, `${pending.length} média(s) KHE en attente`);
          if (!approved) { cellularDeniedRef.current = true; return; }
          cellularApprovedRef.current = true;
          cellularDeniedRef.current = false;
        }
        await syncEngine.drain();
      } catch (error) {
        // Offline-first: queued media and local files remain intact for the next retry.
        console.error('[capture:sync] drain failed', { error: String(error) });
      } finally {
        runningRef.current = false;
      }
    };

    const recoverNow = () => { if (!cancelled) void drain(); };
    void refreshSettings().then(() => drain());
    const timer = setInterval(recoverNow, SYNC_INTERVAL_MS);
    const networkSubscription = Network.addNetworkStateListener((state) => {
      const previousType = lastNetworkTypeRef.current;
      const currentType = state.type ?? null;
      if (previousType === Network.NetworkStateType.CELLULAR && currentType !== Network.NetworkStateType.CELLULAR) {
        cellularApprovedRef.current = false;
        cellularDeniedRef.current = false;
      }
      if (currentType !== previousType) void refreshSettings();
      lastNetworkTypeRef.current = currentType;
      if (shouldRecoverFromNetwork(state)) recoverNow();
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (shouldRecoverFromAppState(state)) void refreshSettings().then(recoverNow);
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [enabled, store, syncEngine]);

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
        if (!cancelled) Alert.alert('Connexion SHARING', 'La réponse n’a pas pu être envoyée. La demande sera reproposée automatiquement.');
      }
    };

    const pollConnectionRequest = async () => {
      if (cancelled || connectionPollRef.current) return;
      connectionPollRef.current = true;
      try {
        const stationToken = await vault.getStationToken();
        if (!stationToken) return;
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
        // CAPTURE reste autonome hors ligne.
      } finally { connectionPollRef.current = false; }
    };

    const recoverConnectionNow = () => { if (!cancelled) void pollConnectionRequest(); };
    void refreshSettings().then(() => pollConnectionRequest());
    const timer = setInterval(recoverConnectionNow, CONNECTION_POLL_INTERVAL_MS);
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (!shouldRecoverFromNetwork(state)) return;
      void refreshSettings().then((settings) => {
        if (shouldImmediateReconnect(settings.autoReconnectStations, true)) recoverConnectionNow();
      });
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (!shouldRecoverFromAppState(state)) return;
      void refreshSettings().then((settings) => {
        if (shouldImmediateReconnect(settings.autoReconnectStations, true)) recoverConnectionNow();
      });
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [api, enabled, vault]);
}
