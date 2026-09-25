export type WidgetParamType = 'integer' | 'string';

export interface WidgetParam {
  name: string;
  type: WidgetParamType;
  required?: boolean;
  // If set, the frontend should GET this path (session-authenticated, same
  // origin) to fetch [{ value, label }] choices and render a dropdown
  // instead of a free-text input — e.g. GitHub's "repo" param points here
  // at /services/github/repos. Absent means "plain text/number input",
  // same as before this field existed.
  optionsUrl?: string;
  // The value is a credential in disguise (a private calendar URL, an API
  // key inside a URL...). It is encrypted at rest and NEVER returned by the
  // API: reads show SECRET_MASK instead. Render it as a password field; to
  // keep the stored value on edit, omit the param or send the mask back.
  secret?: boolean;
}

export interface ServiceAuthContext {
  accessToken?: string;
  credentials?: Record<string, string>;
  // Non-secret facts stored with a linked account (e.g. My Epitech campus/promotion).
  profile?: Record<string, unknown>;
}

// What a widget's enrich() gets: who it's for, in which language to write,
// and an AI client already bound to that user (quota, opt-in and failures handled).
export interface AiClient {
  readonly available: boolean;
  // `mock` is what the offline "mock" provider answers with (dev/tests, no key needed);
  // real providers ignore it. Throws AiUnavailableError when the model can't answer
  // (no key, quota reached, timeout, bad output) — callers fall back to raw data.
  completeJson<T>(args: { system: string; user: string; maxTokens?: number; mock?: T }): Promise<T>;
}

export interface EnrichContext {
  userId: string;
  language: string;
  config: Record<string, string | number>;
  ai: AiClient;
  // Content digests shared across users (public content only), keyed by an opaque string.
  cache: {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<void>;
  };
}

export interface WidgetDefinition {
  name: string;
  description: string;
  params: WidgetParam[];
  // Overrides the service-level requiresAuth for this widget only (e.g. a
  // service with one widget that needs a linked account and others that don't).
  requiresAuth?: boolean;
  // false = never eligible for the public read-only link (private data).
  shareable?: boolean;
  fetchData(
    config: Record<string, string | number>,
    auth?: ServiceAuthContext,
  ): Promise<unknown>;
  // The one number this widget is "about" (a rate, a temperature...). Drives
  // GET /widgets/:id/history and alerts. Absent/null = not numeric.
  primaryMetric?(data: unknown): number | null;
  // Builds the AI-enriched view of a refresh (stored as `insight`). Widgets
  // without one get a generic, data-only summary.
  enrich?(data: unknown, ctx: EnrichContext): Promise<unknown>;
}

export interface ServiceProvider {
  name: string;
  requiresAuth: boolean;
  widgets: WidgetDefinition[];
}

export function widgetNeedsAuth(provider: ServiceProvider, widget: WidgetDefinition): boolean {
  return widget.requiresAuth ?? provider.requiresAuth;
}

export class ServiceFetchError extends Error {
  constructor(
    public readonly serviceName: string,
    public readonly widgetName: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceFetchError';
  }
}
