import { Module } from '@nestjs/common';
import { EpitechProvider } from './epitech.provider';

@Module({
  providers: [EpitechProvider],
  exports: [EpitechProvider],
})
export class EpitechModule {}
