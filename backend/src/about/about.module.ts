import { Module } from '@nestjs/common';
import { AboutController } from './about.controller';
import { AboutService } from './about.service';
import { SERVICE_PROVIDERS } from '../services/service-providers.token';
import type { ServiceProvider } from '../services/service-provider.interface';

@Module({
  controllers: [AboutController],
  providers: [
    AboutService,
    {
      provide: SERVICE_PROVIDERS,
      // Each service module (weather, github, rss, ...) gets added to this
      // list once implemented — that's the only change needed here per service.
      useFactory: (): ServiceProvider[] => [],
    },
  ],
})
export class AboutModule {}
