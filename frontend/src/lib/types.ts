export interface WidgetParam {
  name: string
  type: 'string' | 'integer'
  required?: boolean
}

export interface WidgetDefinition {
  name: string
  description: string
  params: WidgetParam[]
}

export interface ServiceInfo {
  name: string
  widgets: WidgetDefinition[]
}

export interface AboutResponse {
  client: { host: string }
  server: {
    current_time: number
    services: ServiceInfo[]
  }
}

export interface WidgetPosition {
  x: number
  y: number
  w: number
  h: number
}

export interface WidgetInstance {
  id: string
  serviceName: string
  widgetName: string
  config: Record<string, string | number>
  refreshRateSeconds: number
  position: Partial<WidgetPosition>
  lastRefreshedAt: string | null
  cachedData: unknown
  userId: string
  createdAt: string
  updatedAt: string
}
