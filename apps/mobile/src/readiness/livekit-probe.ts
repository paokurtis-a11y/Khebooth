import { registerGlobals } from '@livekit/react-native';
import { Room } from 'livekit-client';
import type { StationExperienceApi } from '../api/station-api';

registerGlobals({ autoConfigureAudioSession: false });

export interface LiveKitProbeResult {
  latencyMs: number;
  serverUrl: string;
}

export async function probeLiveKit(api: StationExperienceApi, stationToken: string, timeoutMs = 8000): Promise<LiveKitProbeResult> {
  const session = await api.liveSession(stationToken);
  if (!session.serverUrl || !session.participantToken) throw new Error('Le serveur LiveKit n’a pas fourni de session sécurisée.');
  const room = new Room({ adaptiveStream: true, dynacast: true });
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      room.connect(session.serverUrl, session.participantToken, { autoSubscribe: false }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Connexion LiveKit trop lente.')), timeoutMs); }),
    ]);
    return { latencyMs: Date.now() - startedAt, serverUrl: session.serverUrl };
  } finally {
    if (timer) clearTimeout(timer);
    await room.disconnect();
  }
}
