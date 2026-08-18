import type { StationControlContract } from '@khe/contracts';
import { API_BASE_URL } from '../config';

async function stationConnectionRequest(
  path: string,
  stationToken: string,
  init: RequestInit,
): Promise<StationControlContract> {
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${stationToken}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { message?: string | string[] };
      if (Array.isArray(body.message)) detail = body.message.join(', ');
      else if (body.message) detail = body.message;
    } catch {}
    throw new Error(detail);
  }

  return await response.json() as StationControlContract;
}

export function respondSharingConnection(stationToken: string, accepted: boolean) {
  return stationConnectionRequest('/stations/control/connection-response', stationToken, {
    method: 'PATCH',
    body: JSON.stringify({ accepted }),
  });
}
