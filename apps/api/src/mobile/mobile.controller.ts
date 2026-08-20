import { Controller, Get, Query } from '@nestjs/common';

const LATEST_VERSION = process.env.MOBILE_LATEST_VERSION?.trim() || '0.3.0';
const INSTALL_URL = process.env.MOBILE_INSTALL_URL?.trim() || 'https://expo.dev/accounts/kurtis-hypnotic-event/projects/kurtis-hypnotic-events/builds';
const RELEASE_NOTES = process.env.MOBILE_RELEASE_NOTES?.trim() || 'KHE Booth 0.3.0 : SHARING Social Business, galerie améliorée, sécurité renforcée, Studio créatif et nouvelles préférences de notifications.';

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((value) => Number.parseInt(value, 10) || 0);
  const pb = b.split('.').map((value) => Number.parseInt(value, 10) || 0);
  const length = Math.max(pa.length, pb.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (pa[index] ?? 0) - (pb[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

@Controller('mobile')
export class MobileController {
  @Get('version')
  version(@Query('current') current = '0.0.0') {
    const updateAvailable = compareVersions(LATEST_VERSION, current) > 0;
    return {
      latestVersion: LATEST_VERSION,
      updateAvailable,
      updateRequired: false,
      releaseNotes: updateAvailable ? RELEASE_NOTES : undefined,
      installUrl: INSTALL_URL,
      policy: 'OPTIONAL',
      message: updateAvailable
        ? `Une nouvelle version KHE Booth ${LATEST_VERSION} est disponible. Vous pouvez continuer avec votre version actuelle, mais la mise à jour donne accès aux nouvelles fonctionnalités et améliorations.`
        : 'Votre version KHE Booth est à jour.',
    };
  }
}