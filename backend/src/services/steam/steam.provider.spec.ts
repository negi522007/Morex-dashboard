import { SteamProvider, parseSteamId } from './steam.provider';
import { ServiceFetchError } from '../service-provider.interface';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const ID = '76561198000000001';

function make(key: string | undefined = 'k') {
  const p = new SteamProvider({ get: () => key } as any);
  const w = (n: string) => p.widgets.find((x) => x.name === n)!;
  return { p, w };
}
// Re-spying on an already-mocked global.fetch throws in Jest, so a second call in the same test
// just swaps the implementation instead of re-wrapping it.
const routes = (map: Record<string, any>) => {
  const impl = async (url: any) => {
    const u = String(url);
    for (const [frag, body] of Object.entries(map)) if (u.includes(frag)) return typeof body === 'function' ? body(u) : json(body);
    return json({}, 404);
  };
  return jest.isMockFunction(global.fetch) ? (global.fetch as jest.Mock).mockImplementation(impl) : jest.spyOn(global, 'fetch').mockImplementation(impl);
};

afterEach(() => jest.restoreAllMocks());

describe('parseSteamId', () => {
  it('accepts ids, profile links and custom names, and rejects the rest', () => {
    expect(parseSteamId(ID)).toEqual({ steamId: ID });
    expect(parseSteamId(`https://steamcommunity.com/profiles/${ID}/`)).toEqual({ steamId: ID });
    expect(parseSteamId('https://steamcommunity.com/id/gaben')).toEqual({ vanity: 'gaben' });
    expect(parseSteamId('gaben')).toEqual({ vanity: 'gaben' });
    for (const bad of ['', 'a', 'not a name!', 'x'.repeat(33)]) expect(parseSteamId(bad)).toBeNull();
  });
});

describe('SteamProvider', () => {
  const player = { steamid: ID, personaname: 'Ada', avatarfull: 'https://a/x.jpg', profileurl: 'https://steamcommunity.com/id/ada/', personastate: 1, communityvisibilitystate: 3, gameextrainfo: 'Hades', timecreated: 1400000000, loccountrycode: 'BJ' };

  it('profile: resolves a custom name, then returns the card and the level as metric', async () => {
    const { w } = make();
    routes({ ResolveVanityURL: { response: { success: 1, steamid: ID } }, GetPlayerSummaries: { response: { players: [player] } }, GetSteamLevel: { response: { player_level: 42 } } });
    const d: any = await w('profile').fetchData({ steamId: 'ada' });
    expect(d).toMatchObject({ steamId: ID, name: 'Ada', status: 'online', currentGame: 'Hades', level: 42, country: 'BJ', isPublic: true });
    expect(w('profile').primaryMetric!(d)).toBe(42);
  });

  it('recent_games: maps games with hours and images, honours the limit', async () => {
    const { w } = make();
    const spy = routes({ GetPlayerSummaries: { response: { players: [player] } }, GetRecentlyPlayedGames: { response: { games: [{ appid: 730, name: 'CS2', playtime_2weeks: 120, playtime_forever: 6000, img_icon_url: 'abc' }] } } });
    const d: any = await w('recent_games').fetchData({ steamId: ID, number: 99 });
    expect(d[0]).toMatchObject({ appId: 730, name: 'CS2', minutesLast2Weeks: 120, minutesTotal: 6000, icon: expect.stringContaining('/730/abc.jpg'), header: expect.stringContaining('/730/header.jpg') });
    expect(spy.mock.calls.map((c) => String(c[0])).find((u) => u.includes('GetRecentlyPlayedGames'))).toContain('count=10');
  });

  it('library_stats: counts games, total hours and the most played', async () => {
    const { w } = make();
    routes({ GetPlayerSummaries: { response: { players: [player] } }, GetOwnedGames: { response: { game_count: 3, games: [
      { appid: 1, name: 'A', playtime_forever: 600 }, { appid: 2, name: 'B', playtime_forever: 60 }, { appid: 3, name: 'C', playtime_forever: 0 } ] } } });
    const d: any = await w('library_stats').fetchData({ steamId: ID });
    expect(d).toMatchObject({ gameCount: 3, playedCount: 2, neverPlayedCount: 1, totalMinutes: 660, totalHours: 11 });
    expect(d.topGames[0].name).toBe('A');
    expect(w('library_stats').primaryMetric!(d)).toBe(11);
  });

  it('explains how to fix a private profile instead of showing an empty card', async () => {
    const { w } = make();
    routes({ GetPlayerSummaries: { response: { players: [{ ...player, communityvisibilitystate: 1 }] } } });
    await expect(w('library_stats').fetchData({ steamId: ID })).rejects.toThrow(/Privacy Settings/);
  });

  it('fails clearly without a server key, on a bad id, on an unknown name, and on a refused key', async () => {
    // A default parameter only kicks in for a literally-omitted arg — `make(undefined)` would still
    // fall back to 'k' and skip this path entirely, so the missing key is an explicit empty string.
    await expect(make('').w('profile').fetchData({ steamId: ID })).rejects.toThrow(/STEAM_API_KEY/);
    await expect(make().w('profile').fetchData({ steamId: '!!' })).rejects.toBeInstanceOf(ServiceFetchError);
    routes({ ResolveVanityURL: { response: { success: 42 } } });
    await expect(make().w('profile').fetchData({ steamId: 'nobody' })).rejects.toThrow(/No Steam profile found/);
    routes({ GetPlayerSummaries: () => json({}, 403) });
    await expect(make().w('profile').fetchData({ steamId: ID })).rejects.toThrow(/refused.*STEAM_API_KEY/);
  });

  it('never lets the API key appear in an error message', async () => {
    const { w } = make('SECRETKEY123');
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connect failed https://api.steampowered.com/x?key=SECRETKEY123'));
    const err: any = await w('profile').fetchData({ steamId: ID }).catch((e) => e);
    expect(err.message).not.toContain('SECRETKEY123');
  });
});
