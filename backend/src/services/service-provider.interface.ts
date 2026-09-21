export type WidgetParamType = 'integer' | 'string';

export interface WidgetParam {
  name: string;
  type: WidgetParamType;
  required?: boolean;
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
