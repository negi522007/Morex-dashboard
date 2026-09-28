import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { MarketDataProvider } from './market-data.provider';
import { MarketAssetsController } from './market-assets.controller';

@Module({
  imports: [AuthModule],
  controllers: [MarketAssetsController],
  providers: [MarketDataProvider],
  exports: [MarketDataProvider],
})
export class MarketDataModule {}
