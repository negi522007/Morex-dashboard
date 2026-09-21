import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

const FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_LIMIT = 5;

interface FeedItem {
  title: string;
  link: string;
  publishedAt: string | null;
}

function extractRawItems(parsed: unknown): Record<string, unknown>[] {
  const root = parsed as Record<string, any>;
  const channelItems = root?.rss?.channel?.item;
  if (channelItems) return Array.isArray(channelItems) ? channelItems : [channelItems];

  const feedEntries = root?.feed?.entry;
  if (feedEntries) return Array.isArray(feedEntries) ? feedEntries : [feedEntries];

  return [];
}

// Handles both RSS 2.0 (<item><link>text</link></item>) and Atom
// (<entry><link href="..."/></entry>) shapes — the two formats real feeds
// actually use, not every historical variant (RDF, namespaced extensions).
function normalizeItem(raw: Record<string, any>): FeedItem {
  const title = typeof raw.title === 'string' ? raw.title : (raw.title?.['#text'] ?? '');

  let link = '';
  if (typeof raw.link === 'string') {
    link = raw.link;
  } else if (Array.isArray(raw.link)) {
    link = raw.link.find((l: any) => l?.['@_rel'] === 'alternate')?.['@_href'] ?? raw.link[0]?.['@_href'] ?? '';
  } else if (raw.link && typeof raw.link === 'object') {
    link = raw.link['@_href'] ?? '';
  }

  const publishedAt = raw.pubDate ?? raw.published ?? raw.updated ?? null;

  return { title, link, publishedAt };
}

const articleList: WidgetDefinition = {
  name: 'article_list',
  description: 'Display the last items from a given feed',
  params: [
    { name: 'link', type: 'string', required: true },
    { name: 'number', type: 'integer' },
  ],
  async fetchData(config): Promise<FeedItem[]> {
    const link = config.link as string;
    if (!link) {
      throw new ServiceFetchError('rss', 'article_list', 'Missing required "link" parameter');
    }

    const parsedNumber = Number(config.number);
    const limit = Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : DEFAULT_LIMIT;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(link, { signal: controller.signal });
    } catch (err) {
      throw new ServiceFetchError('rss', 'article_list', `Could not reach feed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new ServiceFetchError('rss', 'article_list', `Feed returned HTTP ${res.status}`);
    }

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    let parsed: unknown;
    try {
      parsed = parser.parse(xml);
    } catch {
      throw new ServiceFetchError('rss', 'article_list', 'Could not parse feed XML');
    }

    return extractRawItems(parsed).slice(0, limit).map(normalizeItem);
  },
};

@Injectable()
export class RssProvider implements ServiceProvider {
  name = 'rss';
  requiresAuth = false;
  widgets: WidgetDefinition[] = [articleList];
}
