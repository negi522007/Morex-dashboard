import { AboutService } from './about.service';
import type { ServiceProvider } from '../services/service-provider.interface';

function makeRequest(remoteAddress: string) {
  return { socket: { remoteAddress } } as any;
}

describe('AboutService', () => {
  it('lists every registered provider and widget with their params, and nothing else', () => {
    const providers: ServiceProvider[] = [
      {
        name: 'rss',
        requiresAuth: false,
        widgets: [
          {
            name: 'article_list',
            description: 'desc',
            params: [{ name: 'link', type: 'string', required: true }],
            fetchData: async () => ({}),
          },
        ],
      },
    ];
    const service = new AboutService(providers);

    const result = service.build(makeRequest('203.0.113.5'));

    expect(result.server.services).toEqual([
      {
        name: 'rss',
        widgets: [
          { name: 'article_list', description: 'desc', params: [{ name: 'link', type: 'string', required: true }] },
        ],
      },
    ]);
    // requiresAuth and the fetchData function must never leak into the public response.
    expect((result.server.services[0] as any).requiresAuth).toBeUndefined();
    expect((result.server.services[0].widgets[0] as any).fetchData).toBeUndefined();
  });

  it('returns an empty services array when nothing is registered', () => {
    const service = new AboutService([]);
    expect(service.build(makeRequest('203.0.113.5')).server.services).toEqual([]);
  });

  it('strips the "::ffff:" IPv4-mapped IPv6 prefix from client.host', () => {
    const service = new AboutService([]);
    const result = service.build(makeRequest('::ffff:172.18.0.1'));
    expect(result.client.host).toBe('172.18.0.1');
  });

  it('reports current_time as a Unix epoch in seconds', () => {
    const service = new AboutService([]);
    const before = Math.floor(Date.now() / 1000);
    const result = service.build(makeRequest('127.0.0.1'));
    const after = Math.floor(Date.now() / 1000);
    expect(result.server.current_time).toBeGreaterThanOrEqual(before);
    expect(result.server.current_time).toBeLessThanOrEqual(after);
  });
});
