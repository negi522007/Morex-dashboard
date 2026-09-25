import { Global, Module } from '@nestjs/common';
import { SERVICE_PROVIDERS } from './service-providers.token';
import type { ServiceProvider } from './service-provider.interface';
import { RssModule } from './rss/rss.module';
import { RssProvider } from './rss/rss.provider';
import { MarketDataModule } from './market-data/market-data.module';
import { MarketDataProvider } from './market-data/market-data.provider';
import { GithubModule } from './github/github.module';
import { GithubProvider } from './github/github.provider';
import { WorldclockModule } from './worldclock/worldclock.module';
import { WorldclockProvider } from './worldclock/worldclock.provider';
import { WeatherModule } from './weather/weather.module';
import { WeatherProvider } from './weather/weather.provider';

// @Global so AboutModule (about.json) and TimerModule (the scheduler) can
// both inject the same registry without re-declaring it. Adding a new
// service is: import its module here, inject its provider in the factory
// below, and add it to the returned array — nothing else changes.
@Global()
@Module({
  imports: [RssModule, MarketDataModule, GithubModule, WorldclockModule, WeatherModule],
  providers: [
    {
      provide: SERVICE_PROVIDERS,
      useFactory: (
        rss: RssProvider,
        marketData: MarketDataProvider,
        github: GithubProvider,
        worldclock: WorldclockProvider,
        weather: WeatherProvider,
      ): ServiceProvider[] => [rss, marketData, github, worldclock, weather],
      inject: [RssProvider, MarketDataProvider, GithubProvider, WorldclockProvider, WeatherProvider],
    },
  ],
  exports: [SERVICE_PROVIDERS],
})
export class ServicesModule {}
