import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HelpdeskController } from './helpdesk.controller';
import { HelpdeskService } from './helpdesk.service';

@Module({
  imports: [AuthModule],
  controllers: [HelpdeskController],
  providers: [HelpdeskService],
})
export class HelpdeskModule {}
