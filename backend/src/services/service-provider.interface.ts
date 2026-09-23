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
}

export interface ServiceAuthContext {
  accessToken?: string;
  credentials?: Record<string, string>;
}

export interface WidgetDefinition {
  name: string;
  description: string;
  params: WidgetParam[];
  fetchData(
    config: Record<string, string | number>,
    auth?: ServiceAuthContext,
  ): Promise<unknown>;
}

export interface ServiceProvider {
  name: string;
  requiresAuth: boolean;
  widgets: WidgetDefinition[];
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
