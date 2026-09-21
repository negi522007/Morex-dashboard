# Dashboard — Frontend

React app for the Dashboard project: sign up, log in, subscribe to services, and build a personal
dashboard out of configurable, auto-refreshing widgets. This document covers the frontend only — for
the overall project (backend, Docker, architecture) see the [root README](./README.md).

## Status

| Area | Status |
|---|---|
| Auth (register, login, logout, session check) | ✅ Done |
| Widget dashboard (add / reconfigure / move / resize / delete) | ✅ Done |
| GitHub account linking (button) | ✅ Done |
| Per-widget custom rendering (pretty RSS/GitHub/market-data views) | ⏳ Not started — widgets currently render as generic key/value or list dumps |
| Responsive / mobile layout | ⏳ Not tested |

## Tech stack

- **React 19** + **TypeScript**, bundled with **Vite**
- **React Router** (`react-router-dom`) for client-side routing
- **Tailwind CSS v4** for styling (CSS-first config, no `tailwind.config.js` needed — see `frontend/src/index.css`)
- **react-grid-layout** (pinned to `1.5.4`, the last release before its v2 API rewrite) for the
  draggable/resizable widget grid

No state management library, no data-fetching library (React Query, SWR, etc.) — the app is small enough
that `useState`/`useEffect` plus a thin `fetch` wrapper ([`frontend/src/lib/api.ts`](./frontend/src/lib/api.ts)) are
enough. Reach for one of those only if this stops being true.

## Project structure

```
frontend/src/
  pages/               One component per route
    LoginPage.tsx
    RegisterPage.tsx
    DashboardPage.tsx
  components/          Reusable pieces shared across pages
    Logo.tsx
    PasswordInput.tsx      Password field with a show/hide toggle
    WidgetCard.tsx          Renders one widget instance + edit/delete buttons
    WidgetFormModal.tsx     Add/reconfigure form, shared between both flows
  lib/
    api.ts             Thin fetch wrapper: adds `credentials: 'include'`, throws `ApiError` on non-2xx
    types.ts           Shared TypeScript types matching the backend's API contract
  App.tsx              Route table
  main.tsx             Entry point (mounts <App/> inside <BrowserRouter/>)
```

## Getting started

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173` (Vite's default). The backend must be running separately
(`docker compose up` — or `docker-compose up` if your Docker install only has the older standalone tool
— from the repo root) on port `8080`.

### Talking to the backend: the dev proxy

`frontend/vite.config.ts` proxies `/auth`, `/widgets`, and `/about.json` straight to `http://localhost:8080`:

```ts
server: {
  proxy: {
    '/auth': 'http://localhost:8080',
    '/widgets': 'http://localhost:8080',
    '/about.json': 'http://localhost:8080',
  },
},
```

This means every fetch call in the app uses a **relative path** (e.g. `apiFetch('/auth/login', ...)`),
never `http://localhost:8080/...` directly. From the browser's point of view everything is same-origin
(`localhost:5173`), which is what makes the `httpOnly` session cookie work without needing CORS
configured on the backend at all. If you add a new backend route prefix, add it to this proxy list too —
otherwise the browser will 404 on it in dev.

There is no `.env` for the frontend and no build-time API base URL to configure — this proxy is the only
thing that makes it work in dev. In front of a real deployment this routing would need to be handled by
whatever reverse proxy serves both apps (out of scope for now — no such setup exists yet).

### Building for production

```bash
npm run build   # tsc -b && vite build, output in frontend/dist/
npm run preview # serve the built dist/ locally
```

There is no frontend Docker service yet — `docker-compose.yml` only runs the backend, Postgres, and
Mailhog (see the root README's TODO).

## Routes

| Path | Page | Notes |
|---|---|---|
| `/` | — | Redirects to `/login` |
| `/register` | `RegisterPage` | Email + password → `POST /auth/register`. Shows "check your inbox" on success; does **not** log the user in (the backend requires email confirmation first) |
| `/login` | `LoginPage` | `POST /auth/login`. On success, redirects to `/dashboard` |
| `/dashboard` | `DashboardPage` | Protected: checks `GET /auth/me` on mount, redirects to `/login` if there's no valid session |

**Email confirmation has no frontend page.** The link emailed on registration points directly at the
backend (`http://localhost:8080/auth/confirm?token=...`), which replies with a plain-text response
(`Email confirmed. You can now log in.`). This was a deliberate choice, not an oversight: the backend
hard-codes the link's path as `/auth/confirm`, which collides with the `/auth` prefix proxied straight
to the backend above — a frontend route at that same path is unreachable by design of that proxy rule.
Routing this through a styled frontend page would require the backend to build the link with a
different, frontend-owned path instead.

**GitHub OAuth linking has no frontend page either**, same reasoning: `GET /auth/github/callback` is
handled entirely server-side and returns its own plain-text response. The frontend's only job is the
"Link GitHub account" button on `/dashboard`, which does `window.open('/auth/github', '_blank')` —a
normal top-level navigation, not a `fetch()`, since the backend responds with a redirect to GitHub's
consent screen. There is currently no way for the frontend to know afterward whether the linking
succeeded (the `GET /auth/me` response doesn't expose linked-provider status) — the user has to trust
the confirmation message in that new tab.

## The widget dashboard

`DashboardPage` fetches two things on load:

- `GET /about.json` — the catalog of every service/widget the backend currently supports, with each
  widget's configurable `params` (name + `string`/`integer` type, optionally `required`)
- `GET /widgets` — the signed-in user's own widget instances

**Adding or reconfiguring a widget** uses one shared component, [`WidgetFormModal`](./frontend/src/components/WidgetFormModal.tsx):
in "add" mode it lets you pick a service and a widget from the catalog; in "edit" mode the service/widget
are locked (the backend's `PATCH` endpoint only changes `config`/`refreshRateSeconds`/`position`, never
the widget type) and only the config fields are editable. The form fields themselves are generated
dynamically from that widget's `params` — **adding a new service/widget on the backend requires zero
frontend code changes**; it just shows up in the dropdown and gets the right input fields automatically.

**Moving and resizing** use `react-grid-layout`. Dragging is restricted to each card's header via
`draggableHandle=".widget-drag-handle"`, and the edit/delete buttons are explicitly excluded from
triggering a drag via `draggableCancel=".widget-actions"` — without that second part, clicking those
buttons gets swallowed by the drag-start handler instead of firing their `onClick` (this was a real bug,
not a hypothetical one — see git history if curious). On drag/resize stop, the new `{x, y, w, h}` is
`PATCH`ed to the backend immediately.

**Staying in sync**: the page polls `GET /widgets` every 15 seconds (matching the backend scheduler's
own refresh cadence) to pick up new `cachedData`. That poll intentionally only merges in
`cachedData`/refresh timestamps, never `position` — otherwise a poll landing mid-drag could snap a card
back to its last-known-server position while the user is still moving it.

**What a widget actually displays**: `WidgetCard` has no per-widget-type renderer. It just dumps
`cachedData` generically — arrays become a truncated list, objects become key/value pairs, everything
else gets stringified. Building a real per-service look (e.g. an actual RSS feed list, a GitHub commit
timeline, a price chart) is a separate, not-yet-started piece of work.

## Known gaps / intentional simplifications

- No "resend confirmation email" flow — if a signup's token expires (24h) or the email never arrives,
  there is currently no way to get a new one short of registering again with a different address (the
  backend also has no endpoint for this).
- No indicator anywhere in the UI for whether the current user has a GitHub account linked.
- No password-reset flow.
- No loading skeletons — pages that fetch data on mount just briefly show "Loading…" as plain text.
- Weather, Steam, and Maps/Cinema services don't exist on the backend yet, so they simply don't appear
  in the "Add widget" service dropdown — nothing to fix here until they're built server-side.
