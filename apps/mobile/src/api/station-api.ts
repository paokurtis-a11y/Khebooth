import type {
  CaptureStationActivationResponseContract,
  EventManifestContract,
} from '@khe/contracts';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function parseError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    // Fall back to HTTP status below.
  }
  return `Erreur API (${response.status})`;
}

export async function activateCaptureStation(code: string) {
  const response = await fetch(`${API_URL}/station/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as CaptureStationActivationResponseContract;
}

export async function fetchStationManifest(stationToken: string) {
  const response = await fetch(`${API_URL}/station/manifest`, {
    headers: { Authorization: `Bearer ${stationToken}` },
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as EventManifestContract;
}
