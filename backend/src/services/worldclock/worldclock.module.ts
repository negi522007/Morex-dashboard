import { Module } from '@nestjs/common';
import { WorldclockProvider } from './worldclock.provider';
import { WorldclockController } from './worldclock.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [WorldclockController],
  providers: [WorldclockProvider],
  exports: [WorldclockProvider],
})
export class WorldclockModule {}
