import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedStation } from './station-auth.types';

interface StationRequest extends Request {
  station?: AuthenticatedStation;
}

export const CurrentStation = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedStation => {
    const request = context.switchToHttp().getRequest<StationRequest>();
    if (!request.station) {
      throw new Error('Station context is missing');
    }
    return request.station;
  },
);
