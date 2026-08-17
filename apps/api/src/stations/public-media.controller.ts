import { Controller, Get, Param } from '@nestjs/common';
import { MediaSharingService } from './media-sharing.service';

@Controller('public/media')
export class PublicMediaController {
  constructor(private readonly mediaSharing: MediaSharingService) {}

  @Get(':token')
  resolve(@Param('token') token: string) {
    return this.mediaSharing.resolvePublicShare(token);
  }
}
