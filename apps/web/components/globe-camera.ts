export type GlobeZoomLevel = 'world' | 'continent' | 'country' | 'municipality';

export type GlobeCamera = {
  longitude: number;
  latitude: number;
  scale: number;
};

export type GlobeProjection = {
  visible: boolean;
  x: number;
  y: number;
  depth: number;
};

export const GLOBE_ZOOM_LEVELS: GlobeZoomLevel[] = ['world', 'continent', 'country', 'municipality'];

export const GLOBE_ZOOM_SCALES: Record<GlobeZoomLevel, number> = {
  world: 1,
  continent: 1.65,
  country: 3.15,
  municipality: 7,
};

export function clampGlobeScale(value: number) {
  return Math.max(GLOBE_ZOOM_SCALES.world, Math.min(GLOBE_ZOOM_SCALES.municipality, value));
}

export function zoomLevelForScale(scale: number): GlobeZoomLevel {
  const value = clampGlobeScale(scale);
  if (value < (GLOBE_ZOOM_SCALES.world + GLOBE_ZOOM_SCALES.continent) / 2) return 'world';
  if (value < (GLOBE_ZOOM_SCALES.continent + GLOBE_ZOOM_SCALES.country) / 2) return 'continent';
  if (value < (GLOBE_ZOOM_SCALES.country + GLOBE_ZOOM_SCALES.municipality) / 2) return 'country';
  return 'municipality';
}

const CONTINENT_CENTERS: Record<string, [number, number]> = {
  africa: [20, 4],
  asia: [88, 34],
  europe: [15, 50],
  'north america': [-102, 42],
  'south america': [-60, -17],
  oceania: [137, -24],
  antarctica: [0, -76],
};

export function clampLatitude(value: number) {
  return Math.max(-82, Math.min(82, value));
}

export function normalizeLongitude(value: number) {
  let longitude = value;
  while (longitude > 180) longitude -= 360;
  while (longitude < -180) longitude += 360;
  return longitude;
}

export function zoomLevelAt(level: GlobeZoomLevel, delta: number) {
  const index = GLOBE_ZOOM_LEVELS.indexOf(level);
  return GLOBE_ZOOM_LEVELS[Math.max(0, Math.min(GLOBE_ZOOM_LEVELS.length - 1, index + delta))];
}

export function continentCamera(continent: string | null | undefined, fallback: GlobeCamera): GlobeCamera {
  const center = CONTINENT_CENTERS[String(continent ?? '').trim().toLowerCase()];
  return center
    ? { longitude:center[0], latitude:center[1], scale:GLOBE_ZOOM_SCALES.continent }
    : { ...fallback, scale:GLOBE_ZOOM_SCALES.continent };
}

export function projectGlobePoint(
  longitude: number,
  latitude: number,
  camera: GlobeCamera,
  center: number,
  radius: number,
): GlobeProjection {
  const phi = latitude * Math.PI / 180;
  const lambda = (longitude - camera.longitude) * Math.PI / 180;
  const phi0 = camera.latitude * Math.PI / 180;
  const cosPhi = Math.cos(phi);
  const visibility = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * cosPhi * Math.cos(lambda);
  return {
    visible: visibility >= -0.015,
    x: center + radius * camera.scale * cosPhi * Math.sin(lambda),
    y: center - radius * camera.scale * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * cosPhi * Math.cos(lambda)),
    depth: Math.max(0, visibility),
  };
}

export function easeCamera(from: GlobeCamera, to: GlobeCamera, progress: number): GlobeCamera {
  const t = 1 - Math.pow(1 - Math.max(0, Math.min(1, progress)), 3);
  let longitudeDelta = normalizeLongitude(to.longitude - from.longitude);
  if (longitudeDelta === -180) longitudeDelta = 180;
  return {
    longitude: normalizeLongitude(from.longitude + longitudeDelta * t),
    latitude: from.latitude + (to.latitude - from.latitude) * t,
    scale: from.scale + (to.scale - from.scale) * t,
  };
}
