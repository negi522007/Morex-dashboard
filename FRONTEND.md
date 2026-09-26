# Morex — Frontend

React app for the Dashboard project: sign up, log in, and build a personal dashboard out of
configurable, auto-refreshing widgets. This document covers the frontend and **how it talks to the
backend**. For the overall project (backend, Docker, architecture) see the [root README](./README.md),
and for every endpoint see [API.md](./API.md).

## Status

| Area | Status |
|---|---|
| Auth (register, login, logout, session check, "Continue with GitHub") | ✅ Done |
| Dashboard reproducing the validated mockup (`frontend/public/mockups.html`) | ✅ Done |
| One custom card design per widget (20 widgets, 9 services) | ✅ Done |
| iPhone-style editing: long press, jiggle, drag to reorder, resize, delete with undo | ✅ Done |
| Add-widget drawer built from `/about.json`, with live preview | ✅ Done |
| Profile (name, bio, password), avatar builder + photo upload | ✅ Done |
| Themes (10 pictures), widget skins (5), decorations, FR / EN / ES | ✅ Done, saved on the account |
| Private journal (open book) | ✅ Done |
| AI insights (RSS recap, weather advice, GitHub stand-up) | ✅ Displayed when present; needs `AI_PROVIDER` on the server |
| Privacy note acceptance at registration, `/docs` page, GitHub repo picker | ⏳ Not started (see the end) |

## Tech stack

- **React 19** + **TypeScript**, bundled with **Vite**
- **React Router** for the three routes
- **Tailwind CSS v4** for the login / register pages
- **Plain CSS** for the dashboard ([`frontend/src/styles/morex.css`](./frontend/src/styles/morex.css)):
  it is the mockup's stylesheet, ported as-is so the app looks exactly like the validated design

No state library and no data-fetching library: `useState` / `useEffect` plus a thin `fetch` wrapper
([`frontend/src/lib/api.ts`](./frontend/src/lib/api.ts)) are enough for an app this size.

## Project structure

```
frontend/src/
  pages/
    LoginPage.tsx, RegisterPage.tsx   Auth pages (Tailwind)
    DashboardPage.tsx                 Loads the data, holds the state, wires every REST call
  components/
    AuthLayout.tsx, Logo.tsx, PasswordInput.tsx
    morex/                            The dashboard, one file per area of the mockup
      Chrome.tsx        Sidebar, top bar (language, theme, skin, account menu), search, hero (greeting, planet clock, journal card)
      WidgetGrid.tsx    The card frame (badges, resize handle, decoration, footer) and the grid with edit mode
      widgetViews.tsx   One view per card design: reads the widget's cachedData / insight
      Drawer.tsx        "Add widgets" bottom sheet: catalog, previews, typed form
      Modals.tsx        Edit widget, help, logout, profile, avatar, journal
      Decoration.tsx    Stickers around a card (flowers, fairy lights...)
  lib/
    api.ts        fetch wrapper: credentials: 'include', JSON by default, throws ApiError on non-2xx
    types.ts      TypeScript shapes of what the backend returns (User, WidgetInstance, ...)
    catalog.ts    Maps each backend widget to its card design + names and field hints in 3 languages
    samples.ts    Snapshot of real data, used only for the drawer previews
    i18n.ts       All texts in French, English and Spanish
    avatar.ts     DiceBear "avataaars" options and URL builder
    format.ts     Number / date helpers and the useNow() ticking hook
  styles/morex.css   Dashboard styles (from the mockup), scoped under body.morex
```

## Getting started

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The backend must be running on port `8080` (`docker compose up` from the repo root).

### The dev proxy: why every call uses a relative path

[`frontend/vite.config.ts`](./frontend/vite.config.ts) forwards the backend's route prefixes to
`http://localhost:8080`: `/auth`, `/widgets`, `/about.json`, `/journal` and `/uploads` (uploaded avatar
photos). The app therefore always calls relative paths (`/widgets`, not `http://localhost:8080/widgets`).
For the browser everything is same-origin, so the `httpOnly` session cookie just works and the backend
needs no CORS setup. **If you add a backend route prefix that the frontend calls, add it to this list.**

```bash
npm run build      # tsc -b && vite build → frontend/dist/
```

## How the frontend and the backend work together

### 1. Session

`DashboardPage` calls `GET /auth/me` on mount. A 401 sends the user to `/login`. The answer also carries
the user's preferences (`language`, `theme`, `widgetSkin`, `bio`, `avatarConfig`, `avatarPhotoUrl`) and
which accounts are linked (`githubLinked`, `epitech`).

### 2. The catalog comes from `/about.json`

`GET /about.json` lists every service, its widgets and their typed `params` (`string` / `integer`,
`required`, `secret`). The add drawer only offers widgets present there, and builds its form fields from
those `params`. [`catalog.ts`](./frontend/src/lib/catalog.ts) only adds what the backend doesn't know:
which card design to use (`kind`), display names and help texts per language. A widget that exists on the
backend but not in `catalog.ts` is simply not shown in the drawer.

### 3. Widgets: the server fetches, the page displays

The backend's Timer calls each service (RSS, CoinGecko, GitHub, Open-Meteo, YouTube...) at each widget's
refresh rate and stores the answer in the widget's `cachedData` (and the AI result in `insight`). The page
never calls those external APIs itself: it re-reads `GET /widgets` every 15 s and each card renders its
own `cachedData`.

| Card (`kind`) | Backend widget | What the card reads |
|---|---|---|
| `rss` newspaper | `rss/article_list` | `cachedData` = articles; `insight.items[]` = AI recap (summary, whyItMatters, topics) |
| `fx` trading card | `market_data/exchange_rate` | rate, changePct, min, max, history; the 24h/7d/30d tabs PATCH `config.days` |
| `price` coin | `market_data/price_history` | array of `{ price, timestamp }` |
| `gh` terminal, `gh-issues` post-its, `gh-stats` starry sky, `gh-daily` notebook | `github/*` | commits, issues, stars/forks, daily changes; `insight.summary` = AI stand-up |
| `world` 24 h timeline | `worldclock/world_clock` | `home` + `cities` time zones (the card keeps ticking from those zones) |
| `wx-now` living sky, `weather` bars, `wx-hours` chips | `weather/*` | current / daily / hourly forecast; `insight.advice` + `outfit` for the AI advice |
| `cal` countdown | `calendar/upcoming_events` | `events[]` |
| `epi-plan` day ruler, `epi-prof` profile | `epitech/planning`, `epitech/profile` | `events[]`, linked My Epitech profile |
| `api-value` LCD, `api-list` ranking | `custom_api/json_value`, `json_list` | `{ label, value, unit }`, `{ items[] }` |
| `yt-channel`, `yt-latest`, `yt-trend`, `yt-video` | `youtube/*` | channel stats, videos, trending |

While `cachedData` is still `null` (new widget, or the service failed and nothing was ever stored), the
card shows "Waiting for the first data…". After a change that needs a new fetch (new widget, new config,
AI switched on), the page re-reads `/widgets` a few times over the next ~20 s so it appears quickly.

**Secrets** (calendar URL, custom API URL, Epitech token): the backend never sends them back, it answers
`"********"`. The forms show those fields empty; leaving one empty keeps the stored value.

### 4. Every user action is a REST call

| Action in the UI | Call |
|---|---|
| Add a widget (drawer) | `POST /widgets` `{ serviceName, widgetName, config, refreshRateSeconds, position: { order } }` |
| Edit title, refresh rate, decoration, settings, AI switch (✎) | `PATCH /widgets/:id` with only the changed fields |
| Reorder (drag in edit mode) | `PATCH /widgets/:id` `{ position: { order } }` for each card whose rank changed |
| Resize (↘ handle) | `PATCH /widgets/:id` `{ position: { cols, rows } }` (grid cells) |
| Delete (−) | card hidden at once, `DELETE /widgets/:id` sent after 5 s unless "Undo" is pressed |
| Language, theme, widget skin | `PATCH /auth/me` `{ language | theme | widgetSkin }` |
| Profile (name, bio, password) | `PATCH /auth/me` (a password change needs `currentPassword`) |
| Avatar | `PATCH /auth/me { avatarConfig }`, or `POST /auth/me/avatar` (multipart `photo`); `DELETE /auth/me/avatar` to go back to the drawn avatar |
| Journal | `GET /journal`, `POST /journal` on the first keystroke of a new page, then `PATCH /journal/:id` (debounced 600 ms) |
| Connect GitHub / My Epitech (drawer) | top-level navigation to `/auth/github` / `/auth/epitech` (never `fetch()`: the backend redirects) |
| Log out | `POST /auth/logout` |

`position` is free-form JSON on the backend. The dashboard stores `{ order, cols, rows }` in it. Old
positions from the previous react-grid-layout version (`{ x, y, w, h }`) are simply ignored.

### 5. Why the dashboard CSS is scoped

Vite bundles `morex.css` with the rest of the app, so it is loaded on the login page too. Every
page-level rule is therefore written under `body.morex` (the class `DashboardPage` adds on mount and
removes on unmount), and the few resets use `:where()` so they have zero specificity. Theme, skin, edit
mode and the open drawer are also classes / data attributes on `<body>`, exactly like in the mockup.

## Routes

| Path | Page | Notes |
|---|---|---|
| `/` | — | Redirects to `/login` |
| `/register` | `RegisterPage` | `POST /auth/register`, then "check your inbox" (email confirmation is required) |
| `/login` | `LoginPage` | `POST /auth/login`, or "Continue with GitHub" (`<a href="/auth/github/login">`); shows `?error=` from the backend |
| `/dashboard` | `DashboardPage` | Protected by `GET /auth/me` |

**Email confirmation and OAuth callbacks have no frontend page**: they are handled by the backend
(`/auth/confirm`, `/auth/github/callback`, `/auth/epitech/callback`), which are under the proxied `/auth`
prefix anyway.

## Not built yet

- **Privacy note acceptance at registration**: a required checkbox linking to a `/privacy` page rendering
  [PRIVACY.md](./PRIVACY.md). No backend field records the consent yet.
- **In-app documentation page** (`/docs`).
- **GitHub repo picker**: params may carry an `optionsUrl` (GitHub's `repo` → `/services/github/repos`,
  answering `{ value, label }[]`); the drawer still uses a free-text field.
- **Export my data / delete my account**: shown as "soon" in the profile, no backend endpoint yet.
- **Errors from a service** are only in the server logs: the API doesn't expose them per widget, so a
  failing card keeps its last data (or keeps "waiting").
