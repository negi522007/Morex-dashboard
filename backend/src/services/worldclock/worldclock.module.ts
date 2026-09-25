import { Module } from '@nestjs/common';
import { WorldclockProvider } from './worldclock.provider';

@Module({
  providers: [WorldclockProvider],
  exports: [WorldclockProvider],
})
export class WorldclockModule {}
