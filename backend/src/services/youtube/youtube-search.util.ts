import { fetchWithTimeout } from '../../common/fetch-timeout.util';
import { TtlCache } from '../../common/ttl-cache.util';

const API_URL = 'https://www.googleapis.com/youtube/v3';
// Channel names/handles barely change: cache each distinct query for a day. This is the only reason a
// free-text search (the "search" endpoint, 100 of YouTube's 10,000 daily quota units) stays affordable
// at all — see youtube.provider.ts's own comment on why it never uses "search" for the actual widgets.
const DAY_MS = 24 * 3600_000;
const MIN_QUERY_LENGTH = 3;

const cache = new TtlCache();

export interface ChannelSuggestion {
  value: string; // "@handle" (preferred) or a channel id ("UC...") — whatever parseChannel() accepts
  label: string;
  subscribers: number | null;
}

interface SearchItem { snippet?: { channelId?: string } }
interface ChannelItem { id: string; snippet?: { title?: string; customUrl?: string }; statistics?: { subscriberCount?: string } }

export async function searchChannels(query: string, apiKey: string, limit = 8): Promise<ChannelSuggestion[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];
  const max = Math.min(Math.max(Math.floor(limit) || 8, 1), 8);

  return cache.get(`channels:${q.toLowerCase()}:${max}`, DAY_MS, async () => {
    // 1) find candidate channels by name (100 units)
    const searchRes = await fetchWithTimeout(
      `${API_URL}/search?${new URLSearchParams({ part: 'snippet', type: 'channel', q, maxResults: String(max), key: apiKey })}`,
      {},
      10_000,
    );
    if (!searchRes.ok) throw new Error(`YouTube search HTTP ${searchRes.status}`);
    const searchData = (await searchRes.json()) as { items?: SearchItem[] };
    const ids = [...new Set((searchData.items ?? []).map((i) => i.snippet?.channelId).filter((x): x is string => Boolean(x)))];
    if (!ids.length) return [];

    // 2) their real @handle + subscriber count, batched into a single call regardless of how many ids (1 unit)
    const chRes = await fetchWithTimeout(
      `${API_URL}/channels?${new URLSearchParams({ part: 'snippet,statistics', id: ids.join(','), key: apiKey })}`,
      {},
      10_000,
    );
    if (!chRes.ok) throw new Error(`YouTube channels HTTP ${chRes.status}`);
    const chData = (await chRes.json()) as { items?: ChannelItem[] };
    return (chData.items ?? []).map((c): ChannelSuggestion => ({
      value: c.snippet?.customUrl?.startsWith('@') ? c.snippet.customUrl : c.id,
      label: c.snippet?.title ?? c.id,
      subscribers: c.statistics?.subscriberCount != null ? Number(c.statistics.subscriberCount) : null,
    }));
  });
}

/** Test-only: clears the shared cache between specs. */
export function clearChannelSearchCache(): void {
  cache.clear();
}
