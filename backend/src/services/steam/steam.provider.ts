import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchWithTimeout } from '../../common/fetch-timeout.util';
import { ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

const API = 'https://api.steampowered.com';
const STATES = ['offline', 'online', 'busy', 'away', 'snooze', 'looking_to_trade', 'looking_to_play'] as const;

// Accepts a 17-digit SteamID64, a profile URL (/profiles/<id> or /id/<name>) or a custom URL name.
export function parseSteamId(raw: unknown): { steamId: string } | { vanity: string } | null {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  const url = v.match(/steamcommunity\.com\/(profiles|id)\/([A-Za-z0-9_-]+)/i);
  const value = url ? url[2] : v.replace(/\/+$/, '');
  if (/^\d{17}$/.test(value)) return { steamId: value };
  if (/^[A-Za-z0-9_-]{2,32}$/.test(value)) return { vanity: value };
  return null;
}

const iconUrl = (appId: number, hash?: string) => (hash ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${hash}.jpg` : null);
const headerUrl = (appId: number) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
const toGame = (g: any) => ({
  appId: g.appid as number,
  name: String(g.name ?? `App ${g.appid}`),
  minutesLast2Weeks: g.playtime_2weeks ?? 0,
  minutesTotal: g.playtime_forever ?? 0,
  icon: iconUrl(g.appid, g.img_icon_url),
  header: headerUrl(g.appid),
  url: `https://store.steampowered.com/app/${g.appid}`,
});

const PRIVATE_HELP =
  'This Steam profile or its game details are private. In Steam: Profile → Edit Profile → Privacy Settings → set "My profile" and "Game details" to Public';

@Injectable()
export class SteamProvider implements ServiceProvider {
  name = 'steam';
  // The server's own Steam Web API key reads public profiles: no per-user account is needed.
  requiresAuth = false;
  widgets: WidgetDefinition[];

  constructor(private readonly config: ConfigService) {
    const steamIdParam = { name: 'steamId', type: 'string' as const, required: true };

    this.widgets = [
      {
        name: 'profile',
        description: "Display a Steam profile: name, avatar, online status, current game and level",
        params: [steamIdParam],
        primaryMetric: (d) => ((d as { level?: unknown })?.level as number) ?? null,
        fetchData: async (cfg) => {
          const id = await this.resolve(cfg, 'profile');
          const p = await this.player(id, 'profile');
          const level = p.communityvisibilitystate === 3 ? await this.level(id) : null;
          return {
            steamId: id,
            name: p.personaname,
            avatar: p.avatarfull ?? null,
            url: p.profileurl,
            status: STATES[p.personastate] ?? 'offline',
            currentGame: p.gameextrainfo ?? null,
            level,
            memberSince: p.timecreated ? new Date(p.timecreated * 1000).toISOString() : null,
            country: p.loccountrycode ?? null,
            isPublic: p.communityvisibilitystate === 3,
          };
        },
      },
      {
        name: 'recent_games',
        description: 'Display the games played in the last two weeks, with hours played',
        params: [steamIdParam, { name: 'number', type: 'integer' }],
        fetchData: async (cfg) => {
          const id = await this.resolve(cfg, 'recent_games');
          await this.assertPublic(id, 'recent_games');
          const n = Number(cfg.number);
          const count = Number.isInteger(n) && n > 0 ? Math.min(n, 10) : 5;
          const data = await this.get('/IPlayerService/GetRecentlyPlayedGames/v1/', { steamid: id, count: String(count) }, 'recent_games');
          return (data?.response?.games ?? []).map(toGame);
        },
      },
      {
        name: 'library_stats',
        description: 'Display how many games a player owns, total hours played and the most played games',
        params: [steamIdParam],
        // Total hours drive the value history and alerts
        primaryMetric: (d) => ((d as { totalHours?: unknown })?.totalHours as number) ?? null,
        fetchData: async (cfg) => {
          const id = await this.resolve(cfg, 'library_stats');
          await this.assertPublic(id, 'library_stats');
          const data = await this.get(
            '/IPlayerService/GetOwnedGames/v1/',
            { steamid: id, include_appinfo: '1', include_played_free_games: '1' },
            'library_stats',
          );
          const games: any[] = data?.response?.games ?? [];
          const totalMinutes = games.reduce((sum, g) => sum + (g.playtime_forever ?? 0), 0);
          const played = games.filter((g) => (g.playtime_forever ?? 0) > 0).length;
          return {
            steamId: id,
            gameCount: data?.response?.game_count ?? games.length,
            playedCount: played,
            neverPlayedCount: games.length - played,
            totalMinutes,
            totalHours: Math.round(totalMinutes / 60),
            topGames: [...games].sort((a, b) => (b.playtime_forever ?? 0) - (a.playtime_forever ?? 0)).slice(0, 5).map(toGame),
          };
        },
      },
    ];
  }

  private async resolve(cfg: Record<string, string | number>, widget: string): Promise<string> {
    const parsed = parseSteamId(cfg.steamId);
    if (!parsed) {
      throw new ServiceFetchError('steam', widget, `"${cfg.steamId ?? ''}" is not a SteamID64, a profile link or a custom profile name`);
    }
    if ('steamId' in parsed) return parsed.steamId;
    const r = await this.get('/ISteamUser/ResolveVanityURL/v1/', { vanityurl: parsed.vanity }, widget);
    if (r?.response?.success !== 1) throw new ServiceFetchError('steam', widget, `No Steam profile found for "${parsed.vanity}"`);
    return r.response.steamid as string;
  }

  private async player(id: string, widget: string): Promise<any> {
    const r = await this.get('/ISteamUser/GetPlayerSummaries/v2/', { steamids: id }, widget);
    const p = r?.response?.players?.[0];
    if (!p) throw new ServiceFetchError('steam', widget, `No Steam profile found for id ${id}`);
    return p;
  }

  private async level(id: string): Promise<number | null> {
    try {
      const r = await this.get('/IPlayerService/GetSteamLevel/v1/', { steamid: id }, 'profile');
      return r?.response?.player_level ?? null;
    } catch {
      return null; // a nice-to-have: never fail the whole card over it
    }
  }

  private async assertPublic(id: string, widget: string): Promise<void> {
    const p = await this.player(id, widget);
    if (p.communityvisibilitystate !== 3) throw new ServiceFetchError('steam', widget, PRIVATE_HELP);
  }

  private async get(path: string, params: Record<string, string>, widget: string): Promise<any> {
    const key = this.config.get<string>('STEAM_API_KEY');
    if (!key) throw new ServiceFetchError('steam', widget, 'Steam is not configured on the server (STEAM_API_KEY)');
    let res: Response;
    try {
      res = await fetchWithTimeout(`${API}${path}?${new URLSearchParams({ ...params, key })}`, {}, 10_000);
    } catch (err) {
      // The key is in the URL: never let it reach a log line.
      throw new ServiceFetchError('steam', widget, `Could not reach Steam: ${(err as Error).message.split(key).join('[key]')}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ServiceFetchError('steam', widget, `Steam refused the request (HTTP ${res.status}) — check STEAM_API_KEY`);
    }
    if (!res.ok) throw new ServiceFetchError('steam', widget, `Steam returned HTTP ${res.status}`);
    return res.json();
  }
}
