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

## Screens still to build (the backend for each is done — API.md has the exact shapes)

Each block: what the user sees, which calls, and the states to handle (loading, empty, error — the same
standard as the rest of the app). Order = suggested priority for the defense demo.

### 1. World clock dropdown — done ✅, now generalize it (new ask, Sept 28)

`CityPicker.tsx` (type-ahead, arrow keys, flags, chips) already fixes the "Unknown city: Égypte" report —
nice work. **New ask: every field that has an `optionsUrl` in `/about.json` should get the same treatment,
across all services and widgets** — not just the world clock. The backend now offers real suggestions for:

| Service.field | `optionsUrl` | Notes |
|---|---|---|
| `weather.city` (all 3 widgets) | `/services/weather/cities` | live geocoder results |
| `market_data.base` | `…/assets?kind=all` | currencies + crypto |
| `market_data.quote`, `price_history.currency` | `…/assets?kind=fiat` | currencies only |
| `price_history.asset` | `…/assets?kind=crypto` | crypto only |
| `youtube.country` (trending) | `/services/youtube/countries` | closed list — exact match only |
| `rss.link` | `/services/rss/feeds` | a *starting point*, not exhaustive — free text still works |
| `custom_api.path` (both widgets) | `/services/custom_api/inspect` | `dependsOn: ["url"]` — see below |
| `custom_api.titleField`/`subtitleField` | `/services/custom_api/inspect` | `dependsOn: ["url","path"]` |
| `worldclock.homeTimezone`/`cities` | `/services/worldclock/places` | done |
| `wellbeing.horoscope.sign` | `/services/wellbeing/signs` | done (closed list) |
| `github.repo` (all widgets) | `/services/github/repos` | done, pre-existing |

Shapes and exact query params are in API.md → *Services* (each one documented individually, plus the
general contract). **Please generalize `CityPicker.tsx` into a shared `<OptionsField>` (or similar) driven
by the param's own metadata from `/about.json`** — `optionsUrl`, `multiple`, and the new **`dependsOn`**
(see next paragraph) — instead of one hardcoded picker per field. Concretely: the widget-form renderer
already loops over a widget's `params` to build inputs; wherever a param has `optionsUrl`, render the
picker component with `optionsUrl` (plus any built-in query string it already has, e.g.
`?kind=crypto` — append to it, don't replace it) instead of a plain `<input>`. Most fields stay an editable
combobox (typing something not in the list still works, like today); `worldclock`, `wellbeing.sign`,
`youtube.country` and `github.repo` are the only ones that should behave as a **closed** dropdown (exact
value only) — keep the visual style but disable free typing.

**`dependsOn` (new field on `WidgetParam`)**: a field whose suggestions need the *current value of another
field in the same form* — right now only `custom_api.path` (needs `url`) and `titleField`/`subtitleField`
(need `url` **and** `path`). When rendering such a field, append each dependency's current form value as a
query param named after it (`&url=<typed url>&path=<typed path>`); don't call the endpoint at all until
every listed dependency is non-empty (show the field as a normal disabled/plain input meanwhile, with a
hint like "fill in the API address first"). This is what turns the `custom_api` widgets from "paste a URL
and guess a JSON path" into "paste a URL, then pick from what's actually in the response" — a big UX win,
worth doing even if the others wait.

### 2. Help assistant ("helpdesk") — explain the app, the services and the technical words

The audience is not technical. Three entry points, all backed by `/helpdesk/*` (see API.md → Help center):

1. **A floating "?" launcher** on every page (bottom-right; the sidebar's "Help" item opens the same panel),
   opening a **chat panel**:
   - Input + send; suggested questions on first open (from `related` of `guide-getting-started`, or fixed
     chips: "How do I add a widget?", "What is an API key?", "Why is my widget empty?").
   - Each user message → `POST /helpdesk/ask?lang=<ui language>` with `{ question, history, context }`
     (`history` = the last messages of this conversation; `context` = `{ service, widget }` when the user is
     in the add/edit form of a widget, else omitted).
   - Show `answer`, then **source chips** (`sources[]`: title, click → opens that entry), then **follow-up
     chips** (`followUps[]`, click = ask it) and `related[]` as "See also".
   - `mode: "search"` is a normal answer (AI off/over quota): render identically. Optional tiny "AI" badge for
     `mode: "ai"`. The answer is plain text: do not render it as HTML.
   - States: typing indicator while waiting (AI can take a few seconds), a friendly inline error on failure
     with a retry, `400` = "please write a shorter question". Keep the conversation in component state (no
     storage needed). Logged out (login/register pages): use `GET /helpdesk/search?q=` only and show the
     entries' `body` directly.
2. **Contextual help inside the add/edit widget form** — a "?" next to the widget title and next to each
   setting label. Fetch `GET /helpdesk/knowledge?lang=…` once (cached 1 h; keep it in memory) and open the
   entry with id `"<service>/<widget>"` (e.g. `youtube/trending`) in a popover; for a setting with `secret`,
   `optionsUrl`… link to the matching term (`term-secret-param`, `term-timezone`, `term-json-path`,
   `term-ics`, `term-api-key`, `term-youtube-ids`, `term-exchange-rate`, `term-rss`). Each entry has
   `related[]` to link onward. **This works with zero AI and zero extra requests.**
3. **A Help center page** (route `/help`, not `/docs`): the same `knowledge` data as a searchable list grouped
   by `kind` (Guides · Services & widgets · Glossary), with a search box (client-side filter on
   title/body, or `GET /helpdesk/search`), each entry expandable, `related` as links. This is also the
   right place for the existing FAQ block of the Help modal.

Also: in the **empty dashboard** and on any card that stays empty, add a link "Why is my widget empty?" that
opens entry `guide-empty-widget`.

### 3. Daily brief card

Small card at the top of the dashboard (only when `GET /ai/status` says `available`). `GET /brief`:
`brief === null` → "Generate my brief" button (`POST /brief/refresh`; `400` messages such as "Turn AI on for
at least one widget" are shown as is); otherwise `headline`, the `items[]` (each has a `widgetId`: clicking it
scrolls to / highlights that card) and `tip`, plus "Updated <time>" and a refresh button.

### 4. Alerts and notifications

- A **bell** in the toolbar with a badge = number of events newer than the last one the user saw (keep the last
  seen `at` in `localStorage`). Poll `GET /alerts/events` every 30–60 s and on window focus. The dropdown lists
  `message`, time and the widget (`widgetId` → its title).
- In the widget's edit modal, for widgets with a numeric value (the API answers `400 "no numeric value"`
  otherwise — or hide the section using the list in API.md → History), an **Alerts** section: list its alerts
  (`GET /alerts`, filter by `widgetId`) with a toggle (`PATCH active`) and delete; a small form "Notify me when
  the value is [above|below] [number], at most every [60] min" → `POST /alerts`.

### 5. Value history chart

For any widget with a numeric value, a "History" view (7 d / 30 d / 90 d buttons) drawing
`GET /widgets/:id/history?days=` (`points: [{ at, value }]`). Handle `supported: false` (hide the view) and few
points ("collecting data — come back later").

### 6. Sharing

Profile/Settings → **Share my dashboard**: state from `GET /share` (`enabled`, `token`). Buttons: create
(`POST /share`), copy link, regenerate (`POST /share` again — warn that the old link stops working), turn off
(`DELETE /share`). Build the public URL yourself (`${location.origin}/s/${token}`; not under `/public`, which
is proxied to the API). In each widget's edit modal a **"Show on my public page"** switch (`PATCH shared`;
disabled with an explanation for private widgets — calendar/Epitech — the API answers `400`). New route
`/s/:token`: no login, read-only, calls `GET /public/dashboard/:token` **without credentials**, renders the
cards from `widgets[]` with the same components (no edit controls), shows `owner.firstName`, applies `theme`
and `widgetSkin`, and a "This link is not available" page on `404`.

### 7. Add widgets by describing them (assistant) — now a real chat, not one-shot (new ask, Sept 28)

`POST /assistant/widgets` changed from "one message in, suggestions out" to an actual back-and-forth: the
assistant can ask a clarifying question before it has enough to act. Build it as a **small chat panel**
(in the add-widget drawer, above the catalog; shown only when AI is `available`), not a single input+button:

- Keep the conversation in component state: `messages: { role: 'user'|'assistant'; content: string }[]`.
- On send: `POST /assistant/widgets { prompt: <what the user typed>, history: <messages so far> }`.
- Always append the response's `reply` as an assistant bubble — **even when `suggestions` is empty**; that's
  the assistant asking a follow-up (e.g. "What kind of content are you into?"), not a failure. Then let the
  user reply again in the same thread.
- When `suggestions[]` is non-empty, render each as a card under that bubble (title, `reason`, the existing
  widget preview) with an **Add** button → `POST /widgets` (`serviceName, widgetName, config,
  refreshRateSeconds, title`) — unchanged from before. `needsAccount` → "connect `<service>` first";
  non-empty `missingSecrets` → open the normal form pre-filled so the user types those. Nothing is created
  without the click, still.
- States: a typing indicator while waiting, `400` (too long / empty) as an inline error, `available: false`
  → hide the panel entirely.

## Confirmation page, birth date, well-being widgets, Steam, Microsoft (specs — backend done)

### A. The confirmation email page ("Is this you?")

**Already works without the frontend**: the email link opens a backend-rendered page with the two choices (see API.md → *The
confirmation email*). It matches the app's look loosely; if you want it pixel-identical to the Morex design,
build it in React and switch over:
1. Route `/confirm` (public). Set `CONFIRM_PAGE_URL=http://localhost:5173/confirm` in `.env`: the email link
   then redirects to it with `?token=…`.
2. On load `GET /auth/confirm/preview?token=` → show the **masked** address and first name ("Someone used
   a***@gmail.com to create a Morex account"). `401` → a "This link doesn't work" card with a "Sign up again" button.
3. Two buttons: **"Yes, it's me"** → `POST /auth/confirm { token }` then a success card ("Your account is
   confirmed", **Sign in** button → `/login`, and 2–3 first steps: add widgets, add your birth date, connect
   GitHub/Epitech); **"No, it wasn't me"** → `POST /auth/confirm/reject { token }` then a reassurance card
   (nothing was activated, the pending account is deleted, no more sign-up mails to that address for 24 h, safe to
   ignore, it can sign up again tomorrow or use GitHub/Microsoft).
4. States: loading, error with retry, disabled buttons while a request runs, `?lang=` support (use the UI language).
   Never call the confirm/reject endpoints from a `GET` or on page load — only from the buttons.

Also on `/login`: show a friendly banner when the user arrives after confirming (e.g. `?confirmed=1`).

### B. Register form and profile: date of birth

- Register: add a **date field** "Date of birth" (native `<input type="date">`, `max` = today minus 13 years),
  required in the UI, sent as `birthDate: "YYYY-MM-DD"` in `POST /auth/register` (the API validates: real date, ≥ 13
  years old; `400` messages are shown as is). One line under it: "Used only to work out your zodiac sign (to pre-select the
  horoscope widget). Never shown to anyone." (entry `guide-birthdate` in the help). When this ships, set `REQUIRE_BIRTH_DATE=true`.
- Profile: the same field, prefilled from `GET /auth/me` → `birthDate` (`null` = empty), saved with `PATCH /auth/me
  { birthDate }` (`null` clears it). Show `zodiac` next to it as a small badge. Users who signed up with
  GitHub/Epitech/Microsoft have none: the horoscope form simply has no pre-selected sign (see section C).

### C. The "Well-being" group — three widgets (not a page)

New service group **Well-being / Bien-être** in the add-widget drawer (icon e.g. 🌿), with three cards. All free, no
account (data shapes in API.md → *Well-being*): each `cachedData.text` holds `{ en, fr, es }` — **display the one for the
interface language**.
1. **Quote of the day / Citation du jour** (`wellbeing/daily_quote`): big serif quote, author underneath (a
   subtle quotation-mark decoration; proverbs have author "Proverb" — translate that label).
2. **Did you know? / Le saviez-vous ?** (`wellbeing/did_you_know`): a light-bulb icon, the fact, a small topic chip from `topic`
   (nature, space, science, history, tech, body — translate the labels).
3. **Horoscope** (`wellbeing/horoscope`): the sign glyph and name, the text, and **always** the `disclaimer`. A small badge
   "Library" from `source`. When the widget's AI switch is on and `insight` exists (`kind: "horoscope"`), show
   `insight.text` instead with an "AI" badge.
   - **Form:** one required field `sign`, rendered as a dropdown fed by its `optionsUrl`
     (`GET /services/wellbeing/signs?lang=<ui language>` → `[{ value, label, glyph, range }]`, show glyph + label + range).
     **Pre-select `user.zodiac`** from `GET /auth/me` when it is not `null`; if it is `null` (no birth date yet), show a hint
     "Add your birth date in your profile to pre-select your sign" with a link to the profile.
Suggested default refresh rate for the three: 3600 s (they change once a day). The drawer preview can use sample data; the
card itself always shows the widget's own `cachedData`. Help entries: `wellbeing`, `wellbeing/daily_quote`,
`wellbeing/did_you_know`, `wellbeing/horoscope` (see the help assistant spec).

### D. Steam widgets (`steam/*`)

Three new catalog entries, drawn from `cachedData` (shapes in API.md):
- `steam/profile`: avatar, name, a status dot (`online` green, `busy` red, `away`/`snooze` yellow, `offline` grey,
  `looking_*` blue), the `currentGame` line when playing, level badge, "member since".
- `steam/recent_games`: rows with `header`/`icon`, name, "12 h in the last 2 weeks · 340 h total" (minutes ÷ 60).
- `steam/library_stats`: big numbers (`gameCount`, `totalHours`, "N never played"), and the `topGames` list.
Form: one field `steamId`, with a "?" opening help entry `term-steam-id`. If the card stays empty, the reason is in
the server log — common ones: no `STEAM_API_KEY` on the server, private profile ("Game details" must be Public).

### E. Login / register: "Continue with Microsoft" (school account)

Same pattern as GitHub: `<a href="/auth/microsoft/login">`, shown only when `GET /auth/microsoft/status` is
`{ configured: true }`, on **both** login and register pages, with a one-line hint: "Use your school Microsoft
account (@epitech.eu)". Failures come back as `/login?error=<message>`. In Profile → Connected accounts add a
Microsoft row like the GitHub one (`/auth/microsoft` to link, `DELETE /auth/microsoft` to unlink, `microsoft` in
`GET /auth/me`, and `?microsoft=linked` / `?microsoft_error=` after the round trip). The setup steps (registering
the app in Microsoft Entra) are in API.md → *Microsoft sign-in*.

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
