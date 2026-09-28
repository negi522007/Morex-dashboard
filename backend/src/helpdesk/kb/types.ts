export const LANGS = ['en', 'fr', 'es'] as const;
export type Lang = (typeof LANGS)[number];

// [English, French, Spanish]
export type L3 = [string, string, string];

export interface KbEntry {
  // 'service/widget' for a widget, 'service' for a service, else a slug.
  id: string;
  kind: 'service' | 'widget' | 'term' | 'guide';
  title: L3;
  body: L3;
  // Lower-case search words in any of the three languages (matched accent-insensitively).
  keywords: string[];
  related?: string[];
}
