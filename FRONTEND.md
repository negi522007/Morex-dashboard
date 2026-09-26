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

## Admin console (spec — backend is done, no screen yet)

An admin manages accounts. The API exists and is tested (see [API.md → Admin](./API.md#admin)); this section
is what to build. It is optional in the school brief, but the checklist rewards covering everything the
brief mentions.

**Who sees it.** Only when `GET /auth/me` returns `isAdmin: true`. Show an "Admin" entry in the sidebar
for them (nobody else). The route `/admin` must also guard itself: if the user is not an admin, redirect to
`/dashboard`. The API enforces it anyway (`403`), so this is UX, not security.

**How an account becomes admin** (for the demo): the email listed in `ADMIN_EMAILS` (`.env`) gets
`isAdmin` when it *registers*. There is no button or endpoint that promotes anyone, on purpose.

**Routing and proxy.** Add the page at `/admin` (exact). Only the API prefix `/admin/users` is proxied —
add `'/admin/users': 'http://localhost:8080'` to `vite.config.ts` (nginx already has it). Don't proxy the
bare `/admin`, or Vite would send your page to the backend.

**Screen: one table, "Users".** Data from `GET /admin/users`, newest first (sort by `createdAt`):

| Column | From | Notes |
|---|---|---|
| Name | `firstName` `lastName` | |
| Email | `email` | |
| Status | `emailVerified`, `isBanned`, `isAdmin` | Badges: "Unconfirmed" (`emailVerified:false`), "Banned", "Admin". Unconfirmed accounts are deleted by the server after 24 h — say so in a tooltip. |
| Joined | `createdAt` | Relative date |
| Widgets / Linked accounts / Sessions | `widgetCount`, `linkedAccountsCount`, `sessionCount` | Small numbers; `sessionCount` is "sessions stored", not "online now" |
| Actions | — | See below |

Add a search box (client-side filter on name/email) and a filter "All / Unconfirmed / Banned".

**Row actions** (all `credentials: 'include'`, JSON where a body is sent):

| Action | Call | Notes |
|---|---|---|
| Edit name | `PATCH /admin/users/:id` `{ firstName, lastName }` | Blank name → `400`, show the message |
| Mark email as confirmed | `PATCH /admin/users/:id` `{ emailVerified: true }` | For someone whose confirmation mail never arrived |
| Ban | `PATCH /admin/users/:id/ban` → `204` | Ends all their sessions immediately. Confirm dialog first. |
| Unban | `PATCH /admin/users/:id/unban` → `204` | |
| Delete | `DELETE /admin/users/:id` → `204` | **Permanent** (their widgets, journal, links go too). Confirm dialog that makes the admin type the email, or at least a clear warning. |

Rules to reflect in the UI so the admin doesn't hit avoidable errors: you cannot ban or delete **yourself**
or **another admin** (the API answers `400` with a message — hide or disable those buttons for rows where
`isAdmin` is true or `id` equals the current user's id, and still display the API message if it happens).
After any action, refresh the list (or update the row locally). Error states: a `403` (should not happen if
the guard is right) → redirect to `/dashboard`; other errors → a visible message, never a silent failure.
Also show the empty and loading states (the same standard as the dashboard, see the findings below).

**Not in scope:** promoting/demoting admins, changing a user's password or email (no endpoints, by design),
and viewing anyone's widgets or journal (the admin API never exposes private content; keep it that way).

## Login / Register: "Continue with My Epitech" (spec — backend is done)

Creating an account with My Epitech already works on the backend (`GET /auth/epitech/login`: first use
creates the account, already email-verified; a matching verified email attaches to the existing account).
Only the button is missing. `LoginPage` has "Continue with GitHub" (`<a href="/auth/github/login">`); add
next to it, on **both** the login and register pages, **"Continue with My Epitech"** →
`<a href="/auth/epitech/login">` (a real navigation, never `fetch`). Show it only when
`GET /auth/epitech/status` answers `{ "configured": true }` (Epitech staff must declare the app first, see
API.md → My Epitech) — otherwise the button would lead to an error. Failures come back as
`/login?error=<message>`, which the login page already displays. Explain in one line under the button that
the sign-in happens with the student's Microsoft account on Epitech's page.

## Profile → "Connected accounts" (spec — backend is done, this section is missing from the profile)

The profile modal has no way to link or unlink GitHub / My Epitech: today the only entry point is the
"Connect GitHub" button that appears in the add-widget drawer after picking a GitHub widget. The user
expects to manage it in the profile. Add a **Connected accounts** block:

| Row | State from `GET /auth/me` | Action |
|---|---|---|
| GitHub | `githubLinked: true` → "Connected" + **Disconnect**; `false` → **Connect** | Connect: a real navigation, `window.location.href = '/auth/github'` (an `<a href>` works; **never `fetch`**, GitHub's consent page can't be reached that way). Disconnect: `DELETE /auth/github` → `204`, then refresh `/auth/me`. `409` means the account has no password and GitHub is its only login — show the API message ("set a password first"). |
| My Epitech | `epitech` is `null` → **Connect**; else show `epitech.login`, `campus`, `promotion` + **Disconnect** | Same pattern with `/auth/epitech` and `DELETE /auth/epitech`. Only show the row when `GET /auth/epitech/status` answers `{ "configured": true }` (Epitech must first declare the app — see API.md → My Epitech). |

Same for GitHub: hide the Connect button when the server has no GitHub OAuth configured (the API answers
`400 "GitHub OAuth is not configured on the server"`; show that message instead of a dead button).

After the OAuth round trip the backend redirects back to `FRONTEND_URL`: GitHub *link* answers a plain-text
page ("GitHub account linked. You can close this tab.") in the same tab — it is acceptable to open the
Connect link in a new tab and refresh `/auth/me` when the tab closes / on window focus. Epitech redirects to
`/dashboard?epitech=linked` or `/dashboard?epitech_error=<message>` — read those query params, show a toast,
then clear them from the URL.

## Not built yet

- **Privacy note acceptance at registration**: a required checkbox linking to a `/privacy` page rendering
  [PRIVACY.md](./PRIVACY.md). No backend field records the consent yet.
- **In-app documentation page**: not at `/docs` — in production nginx forwards `/docs` to the backend's Swagger UI, so pick another path (e.g. `/help/docs`).
- **GitHub repo picker**: params may carry an `optionsUrl` (GitHub's `repo` → `/services/github/repos`,
  answering `{ value, label }[]`); the drawer still uses a free-text field.
- **Export my data / delete my account**: shown as "soon" in the profile, no backend endpoint yet.
- **Errors from a service** are only in the server logs: the API doesn't expose them per widget, so a
  failing card keeps its last data (or keeps "waiting").


## Defense-checklist findings to fix (found by testing the running app, Sept 26)

Checked in a headless browser against `http://localhost:5173`. Backend behaviour is fine; these are UI:

1. **No error state on the dashboard.** With `GET /widgets` answering `500` the page renders as if
   nothing happened (the widget list just stays empty). The checklist asks that the user "always knows
   what is happening: loading, errors, empty screens". Show a visible message (with a retry) when the
   widget list fails to load, and consider an empty-state hint when there are no widgets yet.
2. **Horizontal overflow** at every size: 16 px on a 390 px phone (the top toolbar is clipped on the left,
   the "EN" pill is cut), 16 px on a 768 px tablet, 4 px on desktop (probably the large decorative day
   number in the hello card). Nothing should make `document.documentElement.scrollWidth` exceed the
   viewport.
3. **Keyboard focus** works (Tab reaches the menu, nav links and buttons) but the focus ring is the browser
   default on a dark glass background and hard to see on several controls; add a clear `:focus-visible`
   style. Icon-only buttons already have names, and images have `alt`.
4. Not verified: colour contrast (light text on the busy background images), and the loading state of the
   dashboard on a slow connection.
