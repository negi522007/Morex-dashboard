import { Module } from '@nestjs/common';
import { MarketDataProvider } from './market-data.provider';

@Module({
  providers: [MarketDataProvider],
  exports: [MarketDataProvider],
})
export class MarketDataModule {}
