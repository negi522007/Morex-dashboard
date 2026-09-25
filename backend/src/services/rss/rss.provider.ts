import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'crypto';
import { safeFetch, type SafeResponse } from '../../common/safe-fetch.util';
import { UNTRUSTED_RULES, clip, languageName } from '../../ai/ai.service';
import {
  EnrichContext,
  ServiceFetchError,
  ServiceProvider,
  WidgetDefinition,
} from '../service-provider.interface';

const FETCH_TIMEOUT_MS = 10_000;
const FEED_MAX_BYTES = 2_000_000;
const ARTICLE_MAX_BYTES = 600_000;
const DEFAULT_LIMIT = 5;
const MAX_ENRICHED_PER_RUN = 5;

export type Fetcher = (url: string, opts?: { timeoutMs?: number; maxBytes?: number }) => Promise<SafeResponse>;

// The first four fields are the original contract; the rest are additive
// (null when the feed doesn't provide them) so existing consumers keep working.
export interface FeedItem {
  title: string;
  link: string;
  publishedAt: string | null;
  image: string | null;
  summary: string | null;
  feedTitle: string | null;
}

interface ItemInsight {
  link: string;
  image: string | null;
  summary: string;
  whyItMatters: string;
  topics: string[];
  readingMinutes: number | null;
  language: string;
}

const textOf = (v: any): string => (typeof v === 'string' ? v : v?.['#text'] ?? '');

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function httpUrl(candidate: unknown, base?: string): string | null {
  if (typeof candidate !== 'string' || !candidate.trim()) return null;
  try {
    const u = new URL(candidate.trim(), base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

function extractRawItems(parsed: unknown): Record<string, unknown>[] {
  const root = parsed as Record<string, any>;
  const channelItems = root?.rss?.channel?.item;
  if (channelItems) return asArray(channelItems);
  const feedEntries = root?.feed?.entry;
  if (feedEntries) return asArray(feedEntries);
  return [];
}

function feedTitleOf(parsed: unknown): string | null {
  const root = parsed as Record<string, any>;
  const t = textOf(root?.rss?.channel?.title) || textOf(root?.feed?.title);
  return t ? clip(stripHtml(t), 120) : null;
}

// Where feeds put a picture: media:content / media:thumbnail, an image
// enclosure, or the first <img> inside the item body.
function imageOf(raw: Record<string, any>, base: string): string | null {
  for (const key of ['media:content', 'media:thumbnail']) {
    for (const m of asArray<any>(raw[key])) {
      const type = m?.['@_type'] as string | undefined;
      if (m?.['@_url'] && (!type || type.startsWith('image/') || key === 'media:thumbnail' || m?.['@_medium'] === 'image')) {
        const u = httpUrl(m['@_url'], base);
        if (u) return u;
      }
    }
  }
  for (const e of asArray<any>(raw.enclosure)) {
    if (String(e?.['@_type'] ?? '').startsWith('image/')) {
      const u = httpUrl(e['@_url'], base);
      if (u) return u;
    }
  }
  const body = textOf(raw['content:encoded']) || textOf(raw.description) || textOf(raw.content) || textOf(raw.summary);
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(body);
  return m ? httpUrl(m[1], base) : null;
}

// Handles both RSS 2.0 (<item><link>text</link></item>) and Atom
// (<entry><link href="..."/></entry>) shapes — the two formats real feeds
// actually use, not every historical variant (RDF).
function normalizeItem(raw: Record<string, any>, feedTitle: string | null, base: string): FeedItem {
  const title = textOf(raw.title);

  let link = '';
  if (typeof raw.link === 'string') {
    link = raw.link;
  } else if (Array.isArray(raw.link)) {
    link = raw.link.find((l: any) => l?.['@_rel'] === 'alternate')?.['@_href'] ?? raw.link[0]?.['@_href'] ?? '';
  } else if (raw.link && typeof raw.link === 'object') {
    link = raw.link['@_href'] ?? '';
  }

  const publishedAt = raw.pubDate ?? raw.published ?? raw.updated ?? null;
  const blurb = textOf(raw.description) || textOf(raw.summary) || textOf(raw['content:encoded']);
  const summary = blurb ? clip(stripHtml(blurb), 280) || null : null;

  return { title, link, publishedAt, image: imageOf(raw, base), summary, feedTitle };
}

function metaContent(html: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
    const tag = re.exec(html)?.[0];
    const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
    if (content) return content;
  }
  return null;
}

interface Article {
  image: string | null;
  text: string;
  readingMinutes: number | null;
}

@Injectable()
export class RssProvider implements ServiceProvider {
  name = 'rss';
  requiresAuth = false;
  // Swappable in tests; in production every server-side fetch goes through the SSRF guard.
  fetcher: Fetcher = safeFetch;
  widgets: WidgetDefinition[];

  constructor() {
    this.widgets = [
      {
        name: 'article_list',
        description: 'Display the last items from a given feed',
        params: [
          { name: 'link', type: 'string', required: true },
          { name: 'number', type: 'integer' },
        ],
        fetchData: (config) => this.fetchFeed(config),
        enrich: (data, ctx) => this.enrich(data as FeedItem[], ctx),
      },
    ];
  }

  private async fetchFeed(config: Record<string, string | number>): Promise<FeedItem[]> {
    const link = config.link as string;
    if (!link) {
      throw new ServiceFetchError('rss', 'article_list', 'Missing required "link" parameter');
    }

    const parsedNumber = Number(config.number);
    const limit = Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : DEFAULT_LIMIT;

    let res: SafeResponse;
    try {
      res = await this.fetcher(link, { timeoutMs: FETCH_TIMEOUT_MS, maxBytes: FEED_MAX_BYTES });
    } catch (err) {
      throw new ServiceFetchError('rss', 'article_list', `Could not reach feed: ${(err as Error).message}`);
    }

    if (!res.ok) {
      throw new ServiceFetchError('rss', 'article_list', `Feed returned HTTP ${res.status}`);
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    let parsed: unknown;
    try {
      parsed = parser.parse(res.text);
    } catch {
      throw new ServiceFetchError('rss', 'article_list', 'Could not parse feed XML');
    }

    const feedTitle = feedTitleOf(parsed);
    return extractRawItems(parsed)
      .slice(0, limit)
      .map((raw) => normalizeItem(raw, feedTitle, res.url || link));
  }

  private async readArticle(link: string): Promise<Article | null> {
    try {
      const res = await this.fetcher(link, { timeoutMs: 8_000, maxBytes: ARTICLE_MAX_BYTES });
      if (!res.ok || !/html|xml/i.test(res.contentType || 'html')) return null;
      const image = httpUrl(metaContent(res.text, ['og:image', 'twitter:image']), res.url);
      const body = /<article[\s\S]*?<\/article>/i.exec(res.text)?.[0] ?? res.text;
      const text = stripHtml(body);
      const words = text.split(' ').filter(Boolean).length;
      const description = metaContent(res.text, ['og:description', 'description']) ?? '';
      return {
        image,
        text: clip(text.length > 200 ? text : `${description} ${text}`, 4000),
        readingMinutes: words >= 80 ? Math.max(1, Math.round(words / 220)) : null,
      };
    } catch {
      // The article page is a bonus: an unreachable/blocked page just means no extras.
      return null;
    }
  }

  // Real images + a short recap in the user's language. Article text and titles
  // are public content, so digests are cached across users; nothing personal is sent.
  private async enrich(items: FeedItem[], ctx: EnrichContext): Promise<unknown> {
    const language = ctx.language;
    const result: ItemInsight[] = [];
    const todo: { item: FeedItem; article: Article | null; key: string }[] = [];

    for (const item of items) {
      if (!item.link) continue;
      const key = 'rss:' + createHash('sha256').update(`${item.link}|${language}`).digest('hex');
      const cached = await ctx.cache.get<ItemInsight>(key);
      if (cached) {
        result.push(cached);
        continue;
      }
      if (todo.length < MAX_ENRICHED_PER_RUN) todo.push({ item, article: await this.readArticle(item.link), key });
    }

    if (todo.length) {
      const payload = todo.map((t, i) => ({
        i,
        title: clip(t.item.title, 160),
        text: clip(t.article?.text || t.item.summary || '', 1500),
      }));
      const mock = {
        items: payload.map((p) => ({ i: p.i, summary: clip(p.text || p.title, 200), whyItMatters: '', topics: [] as string[] })),
      };
      const out = await ctx.ai.completeJson<{ items?: { i: number; summary?: string; whyItMatters?: string; topics?: string[] }[] }>({
        system:
          `You write short, faithful recaps of news articles for a personal dashboard, in ${languageName(language)} ` +
          `(translate if the article is in another language). ${UNTRUSTED_RULES} ` +
          `Schema: {"items":[{"i": number, "summary": string (max 240 chars, the actual information, not a teaser), ` +
          `"whyItMatters": string (max 140 chars, or empty), "topics": string[] (max 3 short tags)}]}. ` +
          `Only use facts present in the text; if the text is too short, summarise the title only.`,
        user: `<data>${JSON.stringify(payload)}</data>`,
        maxTokens: 1200,
        mock,
      });
      for (const o of out.items ?? []) {
        const t = todo[o.i];
        if (!t || typeof o.summary !== 'string' || !o.summary.trim()) continue;
        const insight: ItemInsight = {
          link: t.item.link,
          image: t.item.image ?? t.article?.image ?? null,
          summary: clip(o.summary, 260),
          whyItMatters: clip(o.whyItMatters ?? '', 160),
          topics: asArray(o.topics).filter((x) => typeof x === 'string').slice(0, 3).map((x) => clip(x, 30)),
          readingMinutes: t.article?.readingMinutes ?? null,
          language,
        };
        await ctx.cache.set(t.key, insight);
        result.push(insight);
      }
    }

    // Keep the feed's order.
    const order = new Map(items.map((it, i) => [it.link, i]));
    result.sort((a, b) => (order.get(a.link) ?? 0) - (order.get(b.link) ?? 0));
    return { kind: 'rss_digest', items: result, language };
  }
}
