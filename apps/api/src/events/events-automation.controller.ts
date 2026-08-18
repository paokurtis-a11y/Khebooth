import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('system/events')
export class EventsAutomationController {
  constructor(private readonly events: EventsService) {}

  @Get('complete-ended')
  async completeEnded(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Invalid cron authorization');
    }
    return this.events.completeEndedEvents();
  }
}
