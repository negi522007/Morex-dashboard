# Dashboard — Frontend

React app for the Dashboard project: sign up, log in, subscribe to services, and build a personal
dashboard out of configurable, auto-refreshing widgets. This document covers the frontend only — for
the overall project (backend, Docker, architecture) see the [root README](./README.md).

## Status

| Area | Status |
|---|---|
| Auth (register, login, logout, session check) | ✅ Done |
| "Sign in with GitHub" (LoginPage) | ✅ Done |
| Widget dashboard (add / reconfigure / move / resize / delete) | ✅ Done |
| GitHub account linking (button) | ✅ Done |
| Per-widget custom rendering (pretty RSS/GitHub/market-data views) | ⏳ Not started — widgets currently render as generic key/value or list dumps |
| Responsive / mobile layout | ⏳ Not tested |
| Privacy note acceptance at registration | ⏳ Not started — content exists ([PRIVACY.md](./PRIVACY.md)), no UI yet — see "Planned, not yet built" below |
| In-app / online documentation page | ⏳ Not started — see "Planned, not yet built" below |
| Profile editing (settings page: name, password) | ⏳ Not started — backend done (`PATCH /auth/me`), no UI — see "Planned, not yet built" below |

> **2026-09-21/23 notes:** `RegisterPage.tsx` and the `User` shape in `DashboardPage.tsx` were edited
> directly (not just documented) twice: first to add `firstName`/`lastName` (then optional) and a
> "confirm password" field, then again on the 23rd when `firstName`/`lastName` became **required** —
> `RegisterPage.tsx`'s inputs now have `required` and the request body always sends both, matching the
> backend. Both were one-off, explicitly requested exceptions — Exauce needed to test his own backend
> changes end-to-end without waiting on a frontend PR. Not a standing arrangement: frontend code stays
> Morayo's, and anything below in "Planned, not yet built" is written up for Morayo to implement, not
> something that got built the same way.
>
> **2026-09-23:** `LoginPage.tsx` got a third one-off exception, same reasoning: a "Continue with GitHub"
> link (`<a href="/auth/github/login">`, a real top-level navigation, not a `fetch()` — same reasoning as
> the existing GitHub-linking button) so the new `GET /auth/github/login` backend route (see
> [API.md](./API.md#get-authgithublogin)) could actually be tested end-to-end. It also reads an `?error=`
> query param (set by the backend's callback on a failed GitHub sign-in) into the same error banner the
> form already had. Feel free to reshape/restyle this — the requirement is just that it keeps being a
> real `<a href>` to that exact path.

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

## Planned, not yet built

Written up here as a spec for whoever picks it up (Morayo) — not implemented, on purpose (see the
2026-09-21 note above).

### Privacy note acceptance at registration

`RegisterPage.tsx` currently has no consent step at all. Needed:
- A required checkbox on the register form: "I've read the [privacy note](/privacy)" — submission
  blocked until checked. No backend flag exists to record *that* consent was given or *when* — if that
  needs to be provable later, it's a new `User` field/migration, not just a frontend checkbox.
- A `/privacy` route rendering [`PRIVACY.md`](./PRIVACY.md)'s content — that content **does** exist now
  (plain-language, honest about what's collected and what isn't built yet — e.g. no self-service account
  deletion), written deliberately as a real privacy note rather than fabricated Terms-of-Service legal
  text (this is a student project, not a company; pretend-legal text would be more misleading than no
  text at all). Render the markdown or port it to JSX, whichever fits the rest of the app better — the
  content is the part that mattered, not the format it's in here.
- No separate "Terms of Service" page is planned — there's no commercial terms to state for a project
  like this one; the privacy note covers what actually matters (what data, why, and what control you
  have over it).

### In-app / online documentation page

Right now the project's documentation (`README.md`, `API.md`, `ARCHITECTURE.md`, ...) only exists as
markdown files in the repo — nothing links to any of it from the running app itself. Needed: reserve a
route (e.g. `/docs`) that gives a signed-in (or even signed-out) visitor a way to reach documentation
without going to GitHub — at minimum a link out to the repo's docs, ideally rendering the most
user-relevant parts (what the app does, how to add a widget) directly. Exact scope/design still open;
this is a placeholder for the route and the intent, not a finished spec.

### GitHub repo picker (dropdown instead of free-text)

Backend and contract are done — this is purely a `WidgetFormModal.tsx` rendering change. Every
`WidgetParam` in `/about.json` can now carry an optional `optionsUrl` (see
`service-provider.interface.ts`); GitHub's three widgets set it to `/services/github/repos` on their
`repo` param. When a param has `optionsUrl` set:
1. `GET` that URL (session cookie goes automatically, same as every other call) — response is
   `{ value, label }[]` (see [API.md](./API.md#get-servicesgithubrepos)).
2. Render a `<select>` populated from that array instead of the current free-text `<input>`, submitting
   the chosen `value` as the config value exactly like today.
3. Handle the 400 case (`{"message":"No linked GitHub account for this user..."}`) — probably fall back
   to the current free-text input with that message shown, since the user may not have linked GitHub yet
   (see the "GitHub-linked-status indicator" spec below for how to know that ahead of time).

This was worth building generically rather than as a GitHub-only special case: any future service
(Steam's game list, Maps' cinema list) can reuse the exact same `optionsUrl` handling in
`WidgetFormModal` with zero additional frontend work once its backend sets the field.

### GitHub-linked-status indicator, and an Unlink button

**2026-09-23, raised directly by Exauce:** right now nothing in the UI shows whether the current user has
a GitHub account linked — the "Link GitHub account" button is always shown, even after linking
succeeded, so there's no visual confirmation and no way to tell without trying a GitHub widget and seeing
if it works.

This is now fixable: `GET /auth/me` returns a `githubLinked: boolean` field (see
[API.md](./API.md#get-authme)) added specifically for this. On `DashboardPage`, use it to:
- Show a clear "Linked" state (e.g. a green badge/checkmark next to "Connected accounts") instead of
  always showing the same "Link GitHub account" button regardless of state.
- Once linked, swap that button for an "Unlink" one, calling `DELETE /auth/github` (see
  [API.md](./API.md#delete-authgithub), `204` on success). Handle its `409` case (blocked because this
  account has no password at all — see "Sign in with GitHub" below) by showing that error message as-is;
  there's no "set a password" flow yet for a GitHub-only account to fall back on, so unlinking must stay
  blocked in the UI too, not just the API.
- Re-fetch `/auth/me` (or just flip local state) after a successful link or unlink so the badge/button
  updates immediately instead of only after a page reload.

### Two-step "Add widget" flow (Service, then Widget)

**2026-09-23, raised directly by Exauce:** `WidgetFormModal.tsx` already picks the Widget dropdown's
options based on the chosen Service (`handleServiceChange` resets `widgetName` correctly), but both
`<select>`s are shown together from the start — visually it reads as "pick a widget" with the service as
a secondary detail, rather than "first pick a service, then pick one of its widgets". Requested: make it
a real two-step flow inside the same modal — show only the Service selector first (maybe with each
service's widgets summarized, e.g. widget count or names), and only render the Widget selector (and then
the widget's `params` fields) once a service has been chosen, with a way to go back and change the
service. The underlying data flow (`about.widgets` filtered by `serviceName`) doesn't need to change —
this is purely about the step-by-step presentation.

### Profile editing (settings page)

No UI exists to change your own name or password after registration — the backend is ready
(`PATCH /auth/me`, see [API.md](./API.md#patch-authme)), nothing on the frontend calls it. Needed: a
settings page/modal (reachable from the header, next to the "Connected accounts" card is a reasonable
spot) with:
- Name fields pre-filled from `GET /auth/me`, submitted via `PATCH /auth/me` with just `{ firstName,
  lastName }`.
- A separate "change password" section: `currentPassword` + `newPassword` (+ a client-side "confirm new
  password" match check, same pattern as `RegisterPage.tsx`'s existing confirm-password field) submitted
  via the same endpoint. **After a successful password change, every other session is killed server-side
  automatically** — nothing extra to do here, but worth a "you'll be logged out everywhere else" note in
  the UI so it isn't a surprise.
- Email is intentionally not editable anywhere — the backend doesn't support it (see `API.md`), don't add
  a field for it.

## Known gaps / intentional simplifications

- No "resend confirmation email" flow — if a signup's token expires (24h) or the email never arrives,
  there is currently no way to get a new one short of registering again with a different address (the
  backend also has no endpoint for this).
- No indicator anywhere in the UI for whether the current user has a GitHub account linked — now specced
  in "Planned, not yet built" above, with the backend data it needs already available.
- No password-reset flow.
- No loading skeletons — pages that fetch data on mount just briefly show "Loading…" as plain text.
- Weather, Steam, and Maps/Cinema services don't exist on the backend yet, so they simply don't appear
  in the "Add widget" service dropdown — nothing to fix here until they're built server-side.
