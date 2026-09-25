import { Module } from '@nestjs/common';
import { WidgetsController } from './widgets.controller';
import { WidgetsService } from './widgets.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [WidgetsController],
  providers: [WidgetsService],
  exports: [WidgetsService],
})
export class WidgetsModule {}
