// A small starting list of well-known, reliable feeds, so the "link" field has something to suggest
// instead of a blank box — not exhaustive, and typing any other feed address still works.
export interface CuratedFeed {
  value: string;
  label: string;
  category: 'news' | 'tech' | 'science' | 'sport' | 'business';
}

export const CURATED_FEEDS: CuratedFeed[] = [
  { value: 'https://hnrss.org/frontpage', label: 'Hacker News — Front page', category: 'tech' },
  { value: 'https://www.theverge.com/rss/index.xml', label: 'The Verge', category: 'tech' },
  { value: 'https://techcrunch.com/feed/', label: 'TechCrunch', category: 'tech' },
  { value: 'https://feeds.arstechnica.com/arstechnica/index', label: 'Ars Technica', category: 'tech' },
  { value: 'https://www.wired.com/feed/rss', label: 'Wired', category: 'tech' },
  { value: 'https://feeds.bbci.co.uk/news/world/rss.xml', label: 'BBC News — World', category: 'news' },
  { value: 'https://www.lemonde.fr/rss/une.xml', label: 'Le Monde — Une', category: 'news' },
  { value: 'https://elpais.com/rss/elpais/portada.xml', label: 'El País — Portada', category: 'news' },
  { value: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', label: 'The Wall Street Journal — World', category: 'news' },
  { value: 'https://www.aljazeera.com/xml/rss/all.xml', label: 'Al Jazeera — All', category: 'news' },
  { value: 'https://feeds.npr.org/1001/rss.xml', label: 'NPR — News', category: 'news' },
  { value: 'https://www.reddit.com/r/worldnews/.rss', label: 'Reddit — r/worldnews', category: 'news' },
  { value: 'https://www.nasa.gov/feed/', label: 'NASA', category: 'science' },
  { value: 'https://www.sciencedaily.com/rss/all.xml', label: 'ScienceDaily', category: 'science' },
  { value: 'https://www.espn.com/espn/rss/news', label: 'ESPN', category: 'sport' },
  { value: 'https://www.lequipe.fr/rss/actu_rss.xml', label: "L'Équipe", category: 'sport' },
  { value: 'https://www.ft.com/rss/home', label: 'Financial Times', category: 'business' },
  { value: 'https://feeds.bloomberg.com/markets/news.rss', label: 'Bloomberg — Markets', category: 'business' },
];
