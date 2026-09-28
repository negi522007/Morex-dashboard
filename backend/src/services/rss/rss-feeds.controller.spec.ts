import { RssFeedsController } from './rss-feeds.controller';
import { CURATED_FEEDS } from './feeds.data';

describe('RssFeedsController', () => {
  const ctrl = new RssFeedsController();

  it('returns the whole curated list with no filters', () => {
    expect(ctrl.feeds()).toEqual(CURATED_FEEDS);
  });

  it('filters by name or category substring, and by an exact category', () => {
    expect(ctrl.feeds('verge').map((f) => f.label)).toEqual(['The Verge']);
    expect(ctrl.feeds(undefined, 'sport').every((f) => f.category === 'sport')).toBe(true);
    expect(ctrl.feeds('tech').length).toBeGreaterThan(1);
  });
});
