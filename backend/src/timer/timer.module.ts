import { Module } from '@nestjs/common';
import { TimerService } from './timer.service';

@Module({
  providers: [TimerService],
})
export class TimerModule {}
