import { Global, Module } from '@nestjs/common';
import { SERVICE_PROVIDERS } from './service-providers.token';
import type { ServiceProvider } from './service-provider.interface';
import { RssModule } from './rss/rss.module';
import { RssProvider } from './rss/rss.provider';

// @Global so AboutModule (about.json) and TimerModule (the scheduler) can
// both inject the same registry without re-declaring it. Adding a new
// service is: import its module here, inject its provider in the factory
// below, and add it to the returned array — nothing else changes.
@Global()
@Module({
  imports: [RssModule],
  providers: [
    {
      provide: SERVICE_PROVIDERS,
      useFactory: (rss: RssProvider): ServiceProvider[] => [rss],
      inject: [RssProvider],
    },
  ],
  exports: [SERVICE_PROVIDERS],
})
export class ServicesModule {}
