import { Module } from '@nestjs/common';
import { SteamProvider } from './steam.provider';

@Module({
  providers: [SteamProvider],
  exports: [SteamProvider],
})
export class SteamModule {}
