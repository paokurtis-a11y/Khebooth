import { Controller, Get, Header, Param } from '@nestjs/common';
import { MediaSharingService } from './media-sharing.service';

@Controller('public/media')
export class PublicMediaController {
  constructor(private readonly mediaSharing: MediaSharingService) {}

  @Get(':token')
  @Header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @Header('X-Content-Type-Options', 'nosniff')
  resolve(@Param('token') token: string) {
    return this.mediaSharing.resolvePublicShare(token);
  }
}
