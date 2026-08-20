import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientEnterpriseAccessService } from './client-enterprise-access.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports:[AuthModule],
  controllers:[ClientsController],
  providers:[ClientsService,ClientEnterpriseAccessService],
})
export class ClientsModule {}