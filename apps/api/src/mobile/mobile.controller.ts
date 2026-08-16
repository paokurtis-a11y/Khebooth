import { Controller, Get, Query } from '@nestjs/common';

const LATEST_VERSION = '0.2.0';

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
    return {
      latestVersion: LATEST_VERSION,
      updateAvailable: compareVersions(LATEST_VERSION, current) > 0,
      releaseNotes: 'Interface responsive, menu de station, conditions d’utilisation, galerie interactive et améliorations de capture.',
      installUrl: 'https://expo.dev/accounts/kurtis-hypnotic-event/projects/kurtis-hypnotic-events/builds',
    };
  }
}
