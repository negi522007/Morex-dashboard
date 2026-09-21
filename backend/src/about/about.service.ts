import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SERVICE_PROVIDERS } from '../services/service-providers.token';
import type { ServiceProvider } from '../services/service-provider.interface';

@Injectable()
export class AboutService {
  constructor(@Inject(SERVICE_PROVIDERS) private readonly providers: ServiceProvider[]) {}

  build(req: Request) {
    const rawHost = req.socket.remoteAddress ?? 'unknown';

    return {
      client: {
        host: rawHost.replace(/^::ffff:/, ''),
      },
      server: {
        current_time: Math.floor(Date.now() / 1000),
        services: this.providers.map((provider) => ({
          name: provider.name,
          widgets: provider.widgets.map((widget) => ({
            name: widget.name,
            description: widget.description,
            params: widget.params,
          })),
        })),
      },
    };
  }
}
