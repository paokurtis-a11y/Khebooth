import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import type { LocalMediaRecord } from '../offline/types';

export async function shareMediaNatively(media: LocalMediaRecord): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Le partage natif n’est pas disponible sur cette tablette.');
  }

  const file = new File(media.localUri);
  if (!file.exists) {
    throw new Error('Le fichier local à partager est introuvable.');
  }

  await Sharing.shareAsync(media.localUri, {
    dialogTitle: 'Partager avec KHE Booth',
    mimeType: media.mimeType || undefined,
  });
}
