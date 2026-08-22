import * as Battery from 'expo-battery';
import { Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as SecureStore from 'expo-secure-store';

const GIB = 1024 * 1024 * 1024;
const PRINTER_TEST_PREFIX = 'khe.event-ready.printer-test.v1.';
const PRINTER_TEST_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface HardwareSnapshot {
  availableDiskBytes: number;
  totalDiskBytes: number;
  batteryLevel: number;
  batteryState: Battery.BatteryState;
  lowPowerMode: boolean;
}

export type HardwareLevel = 'PASS' | 'WARN' | 'BLOCK' | 'INFO';

export interface HardwareAssessment {
  disk: { level: HardwareLevel; detail: string };
  battery: { level: HardwareLevel; detail: string };
}

export async function readHardwareSnapshot(): Promise<HardwareSnapshot> {
  const power = await Battery.getPowerStateAsync();
  return {
    availableDiskBytes: Paths.availableDiskSpace,
    totalDiskBytes: Paths.totalDiskSpace,
    batteryLevel: power.batteryLevel,
    batteryState: power.batteryState,
    lowPowerMode: power.lowPowerMode,
  };
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
  const plugged = snapshot.batteryState === Battery.BatteryState.CHARGING || snapshot.batteryState === Battery.BatteryState.FULL || snapshot.batteryState === Battery.BatteryState.NOT_CHARGING;
  let batteryLevel: HardwareLevel = 'PASS';
  if (percent === null) batteryLevel = 'INFO';
  else if (!plugged && percent < 20) batteryLevel = 'BLOCK';
  else if (!plugged && percent < 40) batteryLevel = 'WARN';
  else if (snapshot.lowPowerMode) batteryLevel = 'WARN';
  const state = plugged ? 'alimentation branchée' : 'sur batterie';
  const batteryDetail = percent === null
    ? 'Niveau de batterie non disponible sur cet appareil.'
    : `${percent}% • ${state}${snapshot.lowPowerMode ? ' • économie d’énergie active' : ''}${batteryLevel === 'BLOCK' ? ' • branchez la tablette avant la prestation' : ''}`;

  return { disk: { level: diskLevel, detail: diskDetail }, battery: { level: batteryLevel, detail: batteryDetail } };
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
  return testedAt;
}

export async function runPrinterTest(eventName: string, eventId: string) {
  const escapedName = eventName.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
  const shortId = eventId.slice(0, 8);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;text-align:center;padding:32px;color:#111}h1{font-size:28px}.gold{color:#9b7619}.box{border:2px solid #111;padding:22px;margin-top:24px;border-radius:16px}small{color:#555}</style></head><body><h1>KHE BOOTH</h1><h2 class="gold">TEST IMPRIMANTE ÉVÉNEMENT</h2><div class="box"><strong>${escapedName}</strong><p>Si cette page sort correctement, revenez dans KHE Event Ready et confirmez le test.</p><small>Événement ${shortId} • ${new Date().toLocaleString('fr-CH')}</small></div></body></html>`;
  await Print.printAsync({ html });
}
