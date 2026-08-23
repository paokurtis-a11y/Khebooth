import * as Battery from 'expo-battery';
import { Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import * as Print from 'expo-print';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';

const GIB = 1024 * 1024 * 1024;
const PRINTER_TEST_PREFIX = 'khe.event-ready.printer-test.v1.';
const PRINTER_TEST_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const STATION_TOKEN_KEY = 'khe.station.token.v1';

export interface HardwareSnapshot {
  availableDiskBytes: number;
  totalDiskBytes: number;
  batteryLevel: number;
  batteryState: Battery.BatteryState;
  lowPowerMode: boolean;
  networkType: string;
  networkConnected: boolean | null;
  internetReachable: boolean | null;
}

export type HardwareLevel = 'PASS' | 'WARN' | 'BLOCK' | 'INFO';

export interface HardwareAssessment {
  disk: { level: HardwareLevel; detail: string };
  battery: { level: HardwareLevel; detail: string };
  network: { level: HardwareLevel; detail: string };
}

function isPlugged(state: Battery.BatteryState) {
  return state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL || state === Battery.BatteryState.NOT_CHARGING;
}

async function postReadinessReport(body: Record<string, unknown>) {
  const token = await SecureStore.getItemAsync(STATION_TOKEN_KEY);
  if (!token) return;
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/stations/readiness-report`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Event Ready telemetry HTTP ${response.status}`);
}

export async function readHardwareSnapshot(): Promise<HardwareSnapshot> {
  const [power, network] = await Promise.all([Battery.getPowerStateAsync(), Network.getNetworkStateAsync()]);
  const snapshot: HardwareSnapshot = {
    availableDiskBytes: Paths.availableDiskSpace,
    totalDiskBytes: Paths.totalDiskSpace,
    batteryLevel: power.batteryLevel,
    batteryState: power.batteryState,
    lowPowerMode: power.lowPowerMode,
    networkType: String(network.type ?? 'UNKNOWN'),
    networkConnected: network.isConnected ?? null,
    internetReachable: network.isInternetReachable ?? null,
  };
  try {
    await postReadinessReport({
      batteryPercent: snapshot.batteryLevel < 0 ? null : Math.round(snapshot.batteryLevel * 100),
      charging: isPlugged(snapshot.batteryState),
      lowPowerMode: snapshot.lowPowerMode,
      freeDiskBytes: snapshot.availableDiskBytes,
      totalDiskBytes: snapshot.totalDiskBytes,
      networkType: snapshot.networkType,
      networkConnected: snapshot.networkConnected,
      internetReachable: snapshot.internetReachable,
    });
  } catch {
    // Telemetry must never block an event readiness check or offline capture.
  }
  return snapshot;
}

function gib(bytes: number) {
  return Math.max(0, bytes / GIB);
}

export function assessHardware(snapshot: HardwareSnapshot): HardwareAssessment {
  const free = gib(snapshot.availableDiskBytes);
  const total = gib(snapshot.totalDiskBytes);
  const diskLevel: HardwareLevel = free < 2 ? 'BLOCK' : free < 5 ? 'WARN' : 'PASS';
  const diskDetail = `${free.toFixed(1)} Go libres sur ${total.toFixed(1)} Go${diskLevel === 'BLOCK' ? ' • libérez au moins 2 Go avant la prestation' : diskLevel === 'WARN' ? ' • 5 Go ou plus recommandés' : ''}`;

  const percent = snapshot.batteryLevel < 0 ? null : Math.round(snapshot.batteryLevel * 100);
  const plugged = isPlugged(snapshot.batteryState);
  let batteryLevel: HardwareLevel = 'PASS';
  if (percent === null) batteryLevel = 'INFO';
  else if (!plugged && percent < 20) batteryLevel = 'BLOCK';
  else if (!plugged && percent < 40) batteryLevel = 'WARN';
  else if (snapshot.lowPowerMode) batteryLevel = 'WARN';
  const state = plugged ? 'alimentation branchée' : 'sur batterie';
  const batteryDetail = percent === null
    ? 'Niveau de batterie non disponible sur cet appareil.'
    : `${percent}% • ${state}${snapshot.lowPowerMode ? ' • économie d’énergie active' : ''}${batteryLevel === 'BLOCK' ? ' • branchez la tablette avant la prestation' : ''}`;

  const networkLevel: HardwareLevel = snapshot.networkConnected === false || snapshot.internetReachable === false ? 'WARN' : snapshot.networkConnected === true ? 'PASS' : 'INFO';
  const networkDetail = snapshot.networkConnected === false
    ? 'Réseau indisponible • la capture offline reste disponible.'
    : snapshot.internetReachable === false
      ? `${snapshot.networkType} • réseau détecté sans accès Internet.`
      : snapshot.networkConnected === true
        ? `${snapshot.networkType} • connexion réseau active.`
        : 'État réseau non déterminé.';

  return { disk: { level: diskLevel, detail: diskDetail }, battery: { level: batteryLevel, detail: batteryDetail }, network: { level: networkLevel, detail: networkDetail } };
}

export async function printerTestStatus(eventId: string, now = Date.now()) {
  const raw = await SecureStore.getItemAsync(`${PRINTER_TEST_PREFIX}${eventId}`);
  if (!raw) return { confirmed: false, testedAt: null as string | null };
  const time = Date.parse(raw);
  if (!Number.isFinite(time) || now - time > PRINTER_TEST_MAX_AGE_MS) return { confirmed: false, testedAt: raw };
  return { confirmed: true, testedAt: raw };
}

export async function confirmPrinterTest(eventId: string) {
  const testedAt = new Date().toISOString();
  await SecureStore.setItemAsync(`${PRINTER_TEST_PREFIX}${eventId}`, testedAt, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  try { await postReadinessReport({ printerConfirmed: true, printerTestedAt: testedAt }); } catch {}
  return testedAt;
}

export async function runPrinterTest(eventName: string, eventId: string) {
  const escapedName = eventName.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
  const shortId = eventId.slice(0, 8);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;text-align:center;padding:32px;color:#111}h1{font-size:28px}.gold{color:#9b7619}.box{border:2px solid #111;padding:22px;margin-top:24px;border-radius:16px}small{color:#555}</style></head><body><h1>KHE BOOTH</h1><h2 class="gold">TEST IMPRIMANTE ÉVÉNEMENT</h2><div class="box"><strong>${escapedName}</strong><p>Si cette page sort correctement, revenez dans KHE Event Ready et confirmez le test.</p><small>Événement ${shortId} • ${new Date().toLocaleString('fr-CH')}</small></div></body></html>`;
  await Print.printAsync({ html });
}
