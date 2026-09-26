import { GUIDES } from './guides';
import { SERVICES } from './services';
import { TERMS } from './terms';
import { KbEntry } from './types';

export * from './types';
export const KNOWLEDGE: KbEntry[] = [...GUIDES, ...SERVICES, ...TERMS];
