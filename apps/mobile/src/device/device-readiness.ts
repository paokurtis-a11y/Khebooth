export type DeviceCheckLevel = 'ready' | 'warning' | 'blocked';

export interface DeviceCheck {
  id: 'camera' | 'microphone' | 'storage' | 'battery' | 'orientation' | 'network';
  label: string;
  level: DeviceCheckLevel;
  detail: string;
}

const GIB = 1024 * 1024 * 1024;

export function storageCheck(availableBytes: number): DeviceCheck {
  const gib = availableBytes / GIB;
  if (gib < 1) {
    return { id: 'storage', label: 'Stockage', level: 'blocked', detail: `${gib.toFixed(1)} Go libres · minimum 1 Go` };
  }
  if (gib < 2) {
    return { id: 'storage', label: 'Stockage', level: 'warning', detail: `${gib.toFixed(1)} Go libres · 2 Go recommandés` };
  }
  return { id: 'storage', label: 'Stockage', level: 'ready', detail: `${gib.toFixed(1)} Go libres` };
}

export function batteryCheck(level: number, charging: boolean, lowPowerMode: boolean): DeviceCheck {
  const percent = Math.round(Math.max(0, level) * 100);
  if (!charging && percent < 15) {
    return { id: 'battery', label: 'Batterie', level: 'blocked', detail: `${percent}% · branchez la tablette` };
  }
  if ((!charging && percent < 30) || lowPowerMode) {
    return { id: 'battery', label: 'Batterie', level: 'warning', detail: `${percent}%${lowPowerMode ? ' · économie d’énergie active' : ''}` };
  }
  return { id: 'battery', label: 'Batterie', level: 'ready', detail: charging ? `${percent}% · en charge` : `${percent}%` };
}

export function permissionCheck(id: 'camera' | 'microphone', granted: boolean): DeviceCheck {
  const label = id === 'camera' ? 'Caméra' : 'Microphone';
  return granted
    ? { id, label, level: 'ready', detail: 'Autorisation accordée' }
    : { id, label, level: 'blocked', detail: 'Autorisation requise' };
}

export function orientationCheck(isPortraitUp: boolean): DeviceCheck {
  return isPortraitUp
    ? { id: 'orientation', label: 'Orientation', level: 'ready', detail: 'Portrait 9:16 prêt' }
    : { id: 'orientation', label: 'Orientation', level: 'blocked', detail: 'Placez la tablette en portrait' };
}

export function networkCheck(isConnected: boolean, isReachable: boolean | null): DeviceCheck {
  if (isConnected && isReachable !== false) {
    return { id: 'network', label: 'Réseau', level: 'ready', detail: 'Connexion disponible' };
  }
  return { id: 'network', label: 'Réseau', level: 'warning', detail: 'Hors connexion · capture locale autorisée' };
}

export function isCaptureReady(checks: DeviceCheck[]) {
  return checks.every((check) => check.level !== 'blocked');
}
