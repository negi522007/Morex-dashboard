import { clearChannelSearchCache, searchChannels } from './youtube-search.util';

function mockYoutube(searchItems: { snippet: { channelId: string } }[], channelItems: { id: string; snippet: { title: string; customUrl?: string }; statistics: { subscriberCount: string } }[]) {
  const fetchMock = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/search?')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: searchItems }) });
    if (url.includes('/channels?')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: channelItems }) });
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
  global.fetch = fetchMock as any;
  return fetchMock;
}

describe('searchChannels', () => {
  beforeEach(() => {
    clearChannelSearchCache();
  });

  it('returns nothing under 3 characters, without calling the API', async () => {
    const fetchMock = mockYoutube([], []);
    expect(await searchChannels('da', 'key')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves candidates to their real @handle and subscriber count', async () => {
    mockYoutube(
      [{ snippet: { channelId: 'UC1' } }, { snippet: { channelId: 'UC2' } }],
      [
        { id: 'UC1', snippet: { title: 'David Okit', customUrl: '@davidokitofficiel' }, statistics: { subscriberCount: '177000' } },
        { id: 'UC2', snippet: { title: 'David okit' }, statistics: { subscriberCount: '900' } },
      ],
    );
    const out = await searchChannels('david okit', 'key');
    expect(out).toEqual([
      { value: '@davidokitofficiel', label: 'David Okit', subscribers: 177000 },
      { value: 'UC2', label: 'David okit', subscribers: 900 }, // no customUrl -> falls back to the channel id
    ]);
  });

  it('caches identical queries instead of re-spending quota', async () => {
    const fetchMock = mockYoutube([{ snippet: { channelId: 'UC1' } }], [{ id: 'UC1', snippet: { title: 'X' }, statistics: { subscriberCount: '1' } }]);
    await searchChannels('david okit', 'key');
    await searchChannels('DAVID OKIT', 'key'); // same query, different case
    expect(fetchMock).toHaveBeenCalledTimes(2); // one search + one channels call, not four
  });

  it('returns [] when the search finds nothing, without calling /channels', async () => {
    const fetchMock = mockYoutube([], []);
    expect(await searchChannels('zzzzqqqqxxxx', 'key')).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on a non-2xx response, for the controller to turn into an empty list', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 }) as any;
    await expect(searchChannels('david okit', 'key')).rejects.toThrow(/403/);
  });
});
