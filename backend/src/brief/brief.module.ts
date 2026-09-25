import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BriefController } from './brief.controller';
import { BriefService } from './brief.service';

@Module({
  imports: [AuthModule],
  controllers: [BriefController],
  providers: [BriefService],
})
export class BriefModule {}
