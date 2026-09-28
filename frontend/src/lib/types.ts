export interface WidgetParam {
  name: string
  type: 'string' | 'integer'
  required?: boolean
  // The backend never sends a secret back: it returns "********" instead
  secret?: boolean
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

// Where a card sits in the grid: its rank, and how many columns / rows it spans.
// Stored as-is in the widget's `position` JSON by PATCH /widgets/:id.
export interface WidgetPosition {
  order?: number
  cols?: number
  rows?: number
}

export interface WidgetInstance {
  id: string
  serviceName: string
  widgetName: string
  config: Record<string, string | number>
  refreshRateSeconds: number
  position: WidgetPosition
  title: string | null
  decoration: string | null
  aiEnabled: boolean
  // AI result computed by the backend (enrich), null when AI is off or not configured
  insight: unknown
  insightAt: string | null
  shared: boolean
  lastRefreshedAt: string | null
  // What the service returned at the last refresh (null until the first one succeeds)
  cachedData: unknown
  // Exact reason the last refresh failed, null once one succeeds (stale cachedData is kept regardless)
  lastError: string | null
  userId: string
  createdAt: string
  updatedAt: string
}

export interface EpitechProfile {
  login: string | null
  name: string | null
  email: string | null
  campus: string | null
  promotion: string | null
  cursus: string | null
  groups: string[]
}

export interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  isAdmin: boolean
  createdAt: string
  bio: string | null
  theme: string
  language: string
  widgetSkin: string
  avatarConfig: Record<string, string> | null
  avatarPhotoUrl: string | null
  githubLinked: boolean
  // false = the account signs in only with GitHub / Microsoft / Epitech (no password)
  hasPassword?: boolean
  epitech: EpitechProfile | null
  microsoft: { name: string | null; email: string; tenant: string } | null
  // "YYYY-MM-DD", and the zodiac sign the backend computes from it (both null when unknown)
  birthDate: string | null
  zodiac: string | null
}

export interface JournalEntry {
  id: string
  date: string
  mood: string
  text: string
  createdAt: string
  updatedAt: string
}
