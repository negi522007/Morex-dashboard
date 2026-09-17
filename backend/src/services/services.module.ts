import { Global, Module } from '@nestjs/common';
import { SERVICE_PROVIDERS } from './service-providers.token';
import type { ServiceProvider } from './service-provider.interface';

// @Global so AboutModule (about.json) and TimerModule (the scheduler) can
// both inject the same registry without re-declaring it. Each service
// module (weather, github, rss, ...) gets added to this factory's list once
// implemented — that's the only change needed here per service.
@Global()
@Module({
  providers: [
    {
      provide: SERVICE_PROVIDERS,
      useFactory: (): ServiceProvider[] => [],
    },
  ],
  exports: [SERVICE_PROVIDERS],
})
export class ServicesModule {}
