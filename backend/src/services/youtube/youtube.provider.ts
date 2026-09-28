import { Injectable } from '@nestjs/common';
import { fetchWithTimeout } from '../../common/fetch-timeout.util';
import { ConfigService } from '@nestjs/config';
import { ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

const FETCH_TIMEOUT_MS = 10_000;
const API_URL = 'https://www.googleapis.com/youtube/v3';

// Every call below costs 1 unit of YouTube's 10,000 units/day quota (the
// "search" endpoint costs 100, so it is never used). That's why channels are
// resolved by id or @handle, and videos listed through the uploads playlist.

/** Accepts "@handle", a channel id ("UC…"), or a youtube.com channel URL. */
export function parseChannel(raw: unknown, widgetName: string): { forHandle: string } | { id: string } {
  let value = String(raw ?? '').trim();
  if (!value) throw new ServiceFetchError('youtube', widgetName, 'Missing required "channel" parameter');
  const url = value.match(/youtube\.com\/(@[\w.-]+|channel\/(UC[\w-]{22}))/i);
  if (url) value = url[2] ?? url[1];
  if (/^UC[\w-]{22}$/.test(value)) return { id: value };
  return { forHandle: value.startsWith('@') ? value : `@${value}` };
}

/** Accepts a video id or any youtube.com / youtu.be link to it. */
export function parseVideoId(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  const match = value.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/) ?? value.match(/^([\w-]{11})$/);
  return match ? match[1] : null;
}

function parseNumber(config: Record<string, string | number>, fallback = 5): number {
  const n = Number(config.number);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 25) : fallback;
}

const thumbnail = (snippet: any): string | null =>
  snippet?.thumbnails?.high?.url ?? snippet?.thumbnails?.medium?.url ?? snippet?.thumbnails?.default?.url ?? null;

// The API answers numbers as strings ("123456"); the widgets want numbers.
const toCount = (value: unknown): number | null => (value === undefined ? null : Number(value));

@Injectable()
export class YoutubeProvider implements ServiceProvider {
  name = 'youtube';
  // No per-user account needed: the server's own API key reads public data.
  requiresAuth = false;
  widgets: WidgetDefinition[];

  constructor(private readonly config: ConfigService) {
    const get = (path: string, params: Record<string, string>, widgetName: string) => this.get(path, params, widgetName);

    const findChannel = async (config: Record<string, string | number>, widgetName: string, part: string) => {
      const data = await get('/channels', { part, ...parseChannel(config.channel, widgetName) }, widgetName);
      const channel = data?.items?.[0];
      if (!channel) throw new ServiceFetchError('youtube', widgetName, `No YouTube channel found for "${config.channel}"`);
      return channel;
    };

    const toVideo = (video: any) => ({
      id: video.id,
      title: video.snippet?.title ?? '',
      channel: video.snippet?.channelTitle ?? '',
      thumbnail: thumbnail(video.snippet),
      publishedAt: video.snippet?.publishedAt ?? null,
      views: toCount(video.statistics?.viewCount),
      likes: toCount(video.statistics?.likeCount),
      comments: toCount(video.statistics?.commentCount),
      url: `https://www.youtube.com/watch?v=${video.id}`,
    });

    this.widgets = [
      {
        name: 'channel_stats',
        description: "Display a channel's subscribers, total views and number of videos",
        params: [{ name: 'channel', type: 'string', required: true }],
        // Subscribers drive the value history and alerts (e.g. "tell me at 1 M")
        primaryMetric: (d) => ((d as { subscribers?: unknown })?.subscribers as number) ?? null,
        async fetchData(config) {
          const channel = await findChannel(config, 'channel_stats', 'snippet,statistics');
          return {
            title: channel.snippet?.title ?? '',
            handle: channel.snippet?.customUrl ?? null,
            avatar: thumbnail(channel.snippet),
            // YouTube hides the exact number when the owner chose to
            subscribers: channel.statistics?.hiddenSubscriberCount ? null : toCount(channel.statistics?.subscriberCount),
            views: toCount(channel.statistics?.viewCount),
            videos: toCount(channel.statistics?.videoCount),
            url: channel.id ? `https://www.youtube.com/channel/${channel.id}` : null,
          };
        },
      },
      {
        name: 'latest_videos',
        description: 'Display the latest videos published by a channel',
        params: [
          { name: 'channel', type: 'string', required: true },
          { name: 'number', type: 'integer' },
        ],
        async fetchData(config) {
          const channel = await findChannel(config, 'latest_videos', 'contentDetails');
          const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
          if (!uploads) return [];
          const list = await get('/playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: String(parseNumber(config)) }, 'latest_videos');
          const ids = (list?.items ?? []).map((item: any) => item.contentDetails?.videoId).filter(Boolean);
          if (ids.length === 0) return [];
          // One more 1-unit call to get titles, thumbnails and view counts in one go
          const videos = await get('/videos', { part: 'snippet,statistics', id: ids.join(',') }, 'latest_videos');
          return (videos?.items ?? []).map(toVideo);
        },
      },
      {
        name: 'trending',
        description: 'Display the most popular videos right now in a country (two-letter code, e.g. FR, US, BJ)',
        params: [
          { name: 'country', type: 'string', required: true, optionsUrl: '/services/youtube/countries' },
          { name: 'number', type: 'integer' },
        ],
        async fetchData(config) {
          const country = String(config.country ?? '').trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(country)) {
            throw new ServiceFetchError('youtube', 'trending', `"${config.country}" is not a two-letter country code (e.g. FR, US)`);
          }
          const data = await get(
            '/videos',
            { part: 'snippet,statistics', chart: 'mostPopular', regionCode: country, maxResults: String(parseNumber(config)) },
            'trending',
          );
          return (data?.items ?? []).map(toVideo);
        },
      },
      {
        name: 'video_stats',
        description: 'Display the views, likes and comments of one video (id or link)',
        params: [{ name: 'video', type: 'string', required: true }],
        primaryMetric: (d) => ((d as { views?: unknown })?.views as number) ?? null,
        async fetchData(config) {
          const id = parseVideoId(config.video);
          if (!id) throw new ServiceFetchError('youtube', 'video_stats', `"${config.video}" is not a YouTube video id or link`);
          const data = await get('/videos', { part: 'snippet,statistics', id }, 'video_stats');
          const video = data?.items?.[0];
          if (!video) throw new ServiceFetchError('youtube', 'video_stats', `No YouTube video found for "${config.video}"`);
          return toVideo(video);
        },
      },
    ];
  }

  private async get(path: string, params: Record<string, string>, widgetName: string): Promise<any> {
    const key = this.config.get<string>('YOUTUBE_API_KEY');
    if (!key) throw new ServiceFetchError('youtube', widgetName, 'YouTube is not configured on the server (YOUTUBE_API_KEY)');

    let res: Response;
    try {
      res = await fetchWithTimeout(`${API_URL}${path}?${new URLSearchParams({ ...params, key })}`, {}, FETCH_TIMEOUT_MS);
    } catch (err) {
      throw new ServiceFetchError('youtube', widgetName, `Could not reach YouTube: ${(err as Error).message}`);
    }
    if (!res.ok) {
      // 403 is usually the daily quota or a key restricted to other APIs
      const reason = ((await res.json().catch(() => null)) as any)?.error?.errors?.[0]?.reason;
      throw new ServiceFetchError('youtube', widgetName, `YouTube API returned HTTP ${res.status}${reason ? ` (${reason})` : ''}`);
    }
    return res.json();
  }
}
