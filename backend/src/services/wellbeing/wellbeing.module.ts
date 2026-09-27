import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { WellbeingController } from './wellbeing.controller';
import { WellbeingProvider } from './wellbeing.provider';

@Module({
  imports: [AuthModule],
  controllers: [WellbeingController],
  providers: [WellbeingProvider],
  exports: [WellbeingProvider],
})
export class WellbeingModule {}
