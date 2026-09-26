import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WellbeingController } from './wellbeing.controller';
import { WellbeingService } from './wellbeing.service';

@Module({
  imports: [AuthModule],
  controllers: [WellbeingController],
  providers: [WellbeingService],
})
export class WellbeingModule {}
