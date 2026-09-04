import { Directory, File, Paths } from 'expo-file-system';
import type { StationExperienceApi } from '../api/station-api';
import type { CreativePlan, DesignBackgroundAsset, MusicAsset } from './creative-studio';

function extension(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'audio/mpeg') return 'mp3';
  if (contentType === 'audio/wav' || contentType === 'audio/x-wav') return 'wav';
  if (contentType === 'audio/aac') return 'aac';
  return 'm4a';
}

function cloudRevision(cloudPath:string,fallback:string){
  return cloudPath.split('/').pop()?.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,120)||fallback;
}

async function downloadAsset(api: StationExperienceApi, stationToken: string, cloudPath: string, destination: File) {
  const ticket = await api.designBackgroundDownload(stationToken, cloudPath);
  if (destination.exists && destination.size === ticket.byteSize && destination.size > 0) {
    return { uri: destination.uri, byteSize: destination.size, mimeType: ticket.contentType };
  }
  if (destination.exists) destination.delete();
  const downloaded = await File.downloadFileAsync(ticket.downloadUrl, destination, { idempotent: true });
  if (!downloaded.exists || downloaded.size <= 0 || downloaded.size !== ticket.byteSize) throw new Error('Ressource Studio téléchargée incomplète.');
  return { uri: downloaded.uri, byteSize: downloaded.size, mimeType: ticket.contentType };
}

async function localizeBackground(api: StationExperienceApi, stationToken: string, eventId: string, background: DesignBackgroundAsset | null) {
  if (!background?.cloudPath) return background;
  if (background.localUri) {
    const current = new File(background.localUri);
    if (current.exists && current.size > 0) return background;
  }
  const directory = new Directory(Paths.document, 'studio-backgrounds', eventId);
  directory.create({ idempotent: true, intermediates: true });
  const ticket = await api.designBackgroundDownload(stationToken, background.cloudPath);
  const destination = new File(directory, `${cloudRevision(background.cloudPath,'active-background')}.${extension(ticket.contentType)}`);
  const asset = destination.exists && destination.size === ticket.byteSize && destination.size > 0
    ? { uri: destination.uri, byteSize: destination.size, mimeType: ticket.contentType }
    : await downloadAsset(api, stationToken, background.cloudPath, destination);
  return { ...background, localUri: asset.uri, byteSize: asset.byteSize, mimeType: asset.mimeType };
}

async function localizeMusic(api: StationExperienceApi, stationToken: string, eventId: string, music: MusicAsset[]) {
  const directory = new Directory(Paths.document, 'studio-music', eventId);
  directory.create({ idempotent: true, intermediates: true });
  const localized: MusicAsset[] = [];
  for (const asset of music.slice(0, 3)) {
    if (!asset.cloudPath) {
      if (asset.uri) {
        const local = new File(asset.uri);
        if (local.exists && local.size > 0) localized.push(asset);
      }
      continue;
    }
    if (asset.uri) {
      const local = new File(asset.uri);
      if (local.exists && local.size > 0) { localized.push(asset); continue; }
    }
    const ticket = await api.designBackgroundDownload(stationToken, asset.cloudPath);
    const safeId = cloudRevision(asset.cloudPath,asset.id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'music');
    const destination = new File(directory, `${safeId}.${extension(ticket.contentType)}`);
    const downloaded = destination.exists && destination.size === ticket.byteSize && destination.size > 0
      ? { uri: destination.uri, byteSize: destination.size, mimeType: ticket.contentType }
      : await downloadAsset(api, stationToken, asset.cloudPath, destination);
    localized.push({ ...asset, uri: downloaded.uri, byteSize: downloaded.byteSize, mimeType: downloaded.mimeType });
  }
  return localized;
}

export async function localizeCreativePlan(api: StationExperienceApi, stationToken: string, eventId: string, plan: CreativePlan): Promise<CreativePlan> {
  const [background, music] = await Promise.all([
    localizeBackground(api, stationToken, eventId, plan.background),
    localizeMusic(api, stationToken, eventId, plan.music),
  ]);
  if (plan.audioMode === 'MUSIC_ONLY' && music.length === 0) throw new Error('La playlist Studio n’est pas disponible sur CAPTURE.');
  return { ...plan, background, music };
}
