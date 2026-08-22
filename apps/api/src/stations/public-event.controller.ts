import { Controller, Get, Param } from '@nestjs/common';
import { EventSharingService } from './event-sharing.service';
@Controller('public/events')
export class PublicEventController{constructor(private readonly sharing:EventSharingService){}@Get(':token') resolve(@Param('token') token:string){return this.sharing.resolve(token);}}
