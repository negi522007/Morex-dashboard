import { parseChannel, parseVideoId, YoutubeProvider } from './youtube.provider';
import { ServiceFetchError } from '../service-provider.interface';

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as unknown as Response;
}
const calledUrl = (i = 0) => new URL((global.fetch as jest.Mock).mock.calls[i][0]);

const video = (id: string) => ({
  id,
  snippet: { title: `Video ${id}`, channelTitle: 'Squeezie', publishedAt: '2026-09-20T18:00:00Z', thumbnails: { high: { url: `https://i.ytimg.com/${id}.jpg` } } },
  statistics: { viewCount: '1200000', likeCount: '85000', commentCount: '4300' },
});

describe('YoutubeProvider', () => {
  const provider = new YoutubeProvider({ get: (k: string) => (k === 'YOUTUBE_API_KEY' ? 'test-key' : undefined) } as any);
  const widget = (name: string) => provider.widgets.find((w) => w.name === name)!;

  afterEach(() => jest.restoreAllMocks());

  it('exposes the contract expected by /about.json', () => {
    expect(provider.name).toBe('youtube');
    expect(provider.requiresAuth).toBe(false);
    expect(provider.widgets.map((w) => w.name).sort()).toEqual(['channel_stats', 'latest_videos', 'trending', 'video_stats']);
    for (const w of provider.widgets) expect(w.params.length).toBeGreaterThan(0);
  });

  describe('parameter parsing', () => {
    it('understands @handles, channel ids and channel links', () => {
      expect(parseChannel('@Squeezie', 'w')).toEqual({ forHandle: '@Squeezie' });
      expect(parseChannel('Squeezie', 'w')).toEqual({ forHandle: '@Squeezie' });
      expect(parseChannel('UCWeg2Pkate69NFdBeuRFTAw', 'w')).toEqual({ id: 'UCWeg2Pkate69NFdBeuRFTAw' });
      expect(parseChannel('https://www.youtube.com/@Squeezie/videos', 'w')).toEqual({ forHandle: '@Squeezie' });
      expect(parseChannel('https://youtube.com/channel/UCWeg2Pkate69NFdBeuRFTAw', 'w')).toEqual({ id: 'UCWeg2Pkate69NFdBeuRFTAw' });
      expect(() => parseChannel('', 'w')).toThrow(ServiceFetchError);
    });

    it('understands video ids and every usual kind of video link', () => {
      expect(parseVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ');
      expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(parseVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(parseVideoId('not a video')).toBeNull();
    });
  });

  it('channel_stats returns numbers (the API sends strings) and sends the server key', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        items: [{ id: 'UC1', snippet: { title: 'Squeezie', customUrl: '@squeezie', thumbnails: { high: { url: 'avatar' } } }, statistics: { subscriberCount: '19000000', viewCount: '8000000000', videoCount: '1500' } }],
      }),
    ) as any;
    const result = await widget('channel_stats').fetchData({ channel: '@Squeezie' });
    expect(result).toEqual(expect.objectContaining({ title: 'Squeezie', subscribers: 19000000, views: 8000000000, videos: 1500, avatar: 'avatar' }));
    const url = calledUrl();
    expect(url.pathname).toBe('/youtube/v3/channels');
    expect(url.searchParams.get('forHandle')).toBe('@Squeezie');
    expect(url.searchParams.get('key')).toBe('test-key');
  });

  it('channel_stats hides the subscriber count when the channel hides it', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ items: [{ id: 'UC1', snippet: {}, statistics: { hiddenSubscriberCount: true, subscriberCount: '0', viewCount: '1', videoCount: '1' } }] }),
    ) as any;
    expect(((await widget('channel_stats').fetchData({ channel: '@x' })) as any).subscribers).toBeNull();
  });

  it('raises a readable error for an unknown channel', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ items: [] })) as any;
    await expect(widget('channel_stats').fetchData({ channel: '@doesnotexist' })).rejects.toThrow(/No YouTube channel found/);
  });

  it('latest_videos goes through the uploads playlist (1-unit calls, never the 100-unit search)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ contentDetails: { videoId: 'aaaaaaaaaaa' } }, { contentDetails: { videoId: 'bbbbbbbbbbb' } }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [video('aaaaaaaaaaa'), video('bbbbbbbbbbb')] })) as any;
    const result = (await widget('latest_videos').fetchData({ channel: '@Squeezie', number: 2 })) as any[];
    expect(result.map((v) => v.id)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    expect(result[0]).toEqual(expect.objectContaining({ views: 1200000, thumbnail: 'https://i.ytimg.com/aaaaaaaaaaa.jpg', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }));
    expect(calledUrl(1).searchParams.get('playlistId')).toBe('UU1');
    expect(calledUrl(2).searchParams.get('id')).toBe('aaaaaaaaaaa,bbbbbbbbbbb');
    for (const call of (global.fetch as jest.Mock).mock.calls) expect(call[0]).not.toContain('/search');
  });

  it('trending asks for the most popular videos of a country, capped at 25', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ items: [video('ccccccccccc')] })) as any;
    await widget('trending').fetchData({ country: 'fr', number: 99 });
    const url = calledUrl();
    expect(url.searchParams.get('chart')).toBe('mostPopular');
    expect(url.searchParams.get('regionCode')).toBe('FR');
    expect(url.searchParams.get('maxResults')).toBe('25');
  });

  it('trending rejects something that is not a two-letter country code', async () => {
    await expect(widget('trending').fetchData({ country: 'France' })).rejects.toThrow(/two-letter country code/);
  });

  it('video_stats accepts a link and returns its counts', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ items: [video('dQw4w9WgXcQ')] })) as any;
    const result = (await widget('video_stats').fetchData({ video: 'https://youtu.be/dQw4w9WgXcQ' })) as any;
    expect(result).toEqual(expect.objectContaining({ id: 'dQw4w9WgXcQ', views: 1200000, likes: 85000, comments: 4300 }));
  });

  it('exposes subscribers and views as the primary metric (history and alerts)', () => {
    expect(widget('channel_stats').primaryMetric!({ subscribers: 20200000 })).toBe(20200000);
    expect(widget('video_stats').primaryMetric!({ views: 42 })).toBe(42);
    expect(widget('channel_stats').primaryMetric!({ subscribers: null })).toBeNull();
  });

  it('reports the reason YouTube gives for a 403 (e.g. quota)', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403)) as any;
    await expect(widget('trending').fetchData({ country: 'FR' })).rejects.toThrow('YouTube API returned HTTP 403 (quotaExceeded)');
  });

  it('refuses to run without a server API key', async () => {
    const noKey = new YoutubeProvider({ get: () => undefined } as any);
    await expect(noKey.widgets[0].fetchData({ channel: '@x' })).rejects.toThrow(/YOUTUBE_API_KEY/);
  });
});
