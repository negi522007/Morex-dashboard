# Dashboard

## What is this? (no technical background needed)

Think of your browser's new-tab page — but instead of a search bar and a few shortcuts, you decide
what's on it. You build your own little control panel: one box showing your latest GitHub activity,
another showing today's crypto prices, another showing headlines from a blog you like. Each box is a
"widget," and it keeps itself up to date on its own — you never have to refresh it by hand.

To use it, you make an account with your email and confirm it, the same way as most sites. If a widget
needs to look at something private (like your own GitHub account), you connect that account once — the
app never sees your GitHub password, only a permission GitHub itself hands over, and you can always
disconnect it later. Then you add whichever widgets you want, arrange them however you like, and that's
your dashboard.

## Overview

A customizable web dashboard: users sign up, subscribe to services (GitHub, weather, RSS, YouTube, ...),
then build their own dashboard by adding, configuring, and moving widgets. Each widget refreshes
automatically at a user-defined interval.

## Services & widgets

| Service | Auth required | Status | Widgets |
|---|---|---|---|
| RSS | No | ✅ Done | `article_list` (link, number) |
| Market data | No | ✅ Done | `exchange_rate` (base, quote, days — fiat pairs like EUR→USD via ECB, crypto via CoinGecko; returns its history), `price_history` (asset, days, currency) |
| GitHub | OAuth 2.0 | ✅ Done | `recent_commits` (repo, number), `open_issues` (repo, number), `repo_stats` (repo), `daily_changes` (repo, hours — stand-up of the last hours) |
| World clock | No | ✅ Done | `world_clock` (homeTimezone, cities) — pure timezone math, no external API |
| Weather | No | ✅ Done | `current_weather`, `daily_forecast`, `hourly_forecast` (city, unit, days/hours) — Open-Meteo, no key |
| YouTube | Server API key (`YOUTUBE_API_KEY`) | ✅ Done | `channel_stats`, `latest_videos`, `trending`, `video_stats` |
| Calendar | No (secret iCal URL) | ✅ Done | `upcoming_events` (url, days, number) — Google Calendar's secret iCal address or any `.ics` |
| My Epitech | Optional ("Connect with My Epitech", OIDC) | ✅ Done* | `planning` (calendarToken), `profile` — *login needs Epitech staff to declare the app, see API.md |
| Custom API | No | ✅ Done | `json_value`, `json_list` — any public JSON API, chosen with a URL + path |
| Well-being | No | ✅ Done | `daily_quote`, `did_you_know`, `horoscope` (sign) — written in EN/FR/ES, horoscope labelled "for fun" |
| Maps / Cinema | API key | ⏳ Not started | — |

**Beyond widgets** (all documented in [API.md](./docs/API.md)): a **Well-being** widget group (quote of the day, "did you know?", horoscope), an "Is this you?" **confirmation page** with a "not me" option, **sign-in with a school Microsoft account**, a **help assistant** that explains the app, each service and the technical vocabulary in plain words (English/French/Spanish, works with or without AI), optional **AI** (article recaps with images,
per-widget insights, a daily brief, a real back-and-forth **widget-creation chat** — off unless `AI_PROVIDER`/`AI_API_KEY`
are set, opt-in per widget, never touches the journal), **threshold alerts** (in-app + email), **value
history** for charts, a **read-only public share link**, a private **journal** (entries encrypted at rest),
a DiceBear/photo **avatar editor**, **exporting your own data** as one JSON file, **deleting your own
account**, every widget surfacing the **exact reason its last refresh failed** instead of an indefinite
"waiting for data", and **SSRF protection** on every user-supplied URL the server fetches. Not built, on
purpose: Google Photos, Epitech student data (credits/XP), and Steam (Valve gates API keys behind having
spent real money once) — reasons in API.md.

The exact list currently live (names, descriptions, parameters) is always exposed dynamically by the
server at `GET /about.json` — this table can drift, that endpoint can't.

## Install & run

You only need **Docker** (with Compose v2). From a fresh clone:

```bash
docker compose up --build
```

That is all: it builds and starts the API, the database, a local mail catcher and the web app, runs the
database migrations, and generates the encryption key it needs. No `.env` file is required.

| What | Where |
|---|---|
| Web app | http://localhost:5173 |
| API (and `GET /about.json`) | http://localhost:8080 |
| Interactive API docs | http://localhost:8080/docs |
| Mail catcher (confirmation emails land here by default) | http://localhost:8025 |

Quick check: `curl http://localhost:8080/about.json`. To try it: open the web app, register, open the
confirmation email in the mail catcher, click its link, log in.

**Optional features** are switched on by copying `.env.example` to `.env` and filling in what you want,
then `docker compose up -d --force-recreate server`: real SMTP delivery, "Sign in with GitHub", "Connect
with My Epitech", the AI features (free providers work), the YouTube widgets (`YOUTUBE_API_KEY`) and
your own `TOKEN_ENCRYPTION_KEY` (otherwise one is generated and kept in a Docker volume — set your own
for anything beyond local use, and never change it once data exists). Confirmation links use `APP_URL`
(`http://localhost:8080`): they only work on the machine running the server unless you set a public URL.

**Working on the frontend with hot reload** (instead of the containerised build):

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 — stop the `frontend` container first, it uses the same port
```

See [FRONTEND.md](./docs/FRONTEND.md) for what's built there (routes, the dev proxy, what isn't yet).

## How to use it

The walkthrough below uses `curl` directly against the API — useful to understand the contract or debug
independently of the UI. For the actual app, use the frontend at `http://localhost:5173` instead; it
makes these exact same requests. Full endpoint reference: [API.md](./docs/API.md).

**1. Create an account and confirm it.** (`firstName`/`lastName` are required; editable later via
`PATCH /auth/me`.)
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-real-password","firstName":"Ada","lastName":"Lovelace"}'
```
By default this lands in **Mailhog** (`http://localhost:8025`), not a real inbox — see
[CONTRIBUTING.md](./docs/CONTRIBUTING.md#sending-real-confirmation-emails-not-just-to-mailhog) to configure
real delivery instead. Open Mailhog and click the confirmation link, or grab the link's `token` and hit
it directly:
```bash
curl "http://localhost:8080/auth/confirm?token=<paste-the-token-here>"
```

**2. Log in.** `-c cookies.txt` saves the session cookie so later commands can reuse it.
```bash
curl -c cookies.txt -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-real-password"}'
```

**3. (Optional) Link GitHub — only needed for GitHub widgets.** Open this URL in a real browser (not
`curl` — it needs your GitHub login and consent), while logged in above via the same browser:
`http://localhost:8080/auth/github`.

**4. See what's available.**
```bash
curl http://localhost:8080/about.json
```

**5. Add a widget to your dashboard.**
```bash
curl -b cookies.txt -X POST http://localhost:8080/widgets \
  -H "Content-Type: application/json" \
  -d '{"serviceName":"rss","widgetName":"article_list","config":{"link":"https://hnrss.org/frontpage","number":3},"refreshRateSeconds":60}'
```

**6. Watch it fill itself in.** The scheduler refreshes every 15s — wait a moment, then:
```bash
curl -b cookies.txt http://localhost:8080/widgets
```
`cachedData` goes from `null` to real data on its own; you never trigger a refresh manually.

**7. Reconfigure or move it** (send whichever of `config`/`refreshRateSeconds`/`position` changed):
```bash
curl -b cookies.txt -X PATCH http://localhost:8080/widgets/<id-from-step-6> \
  -H "Content-Type: application/json" \
  -d '{"position":{"x":2,"y":0,"w":4,"h":2}}'
```

**8. Remove it.**
```bash
curl -b cookies.txt -X DELETE http://localhost:8080/widgets/<id>
```

**9. Log out** (kills the session immediately, server-side):
```bash
curl -b cookies.txt -X POST http://localhost:8080/auth/logout
```

## Technologies

- **Backend**: Node.js / NestJS + Prisma + PostgreSQL
- **Frontend**: React + Tailwind + react-grid-layout
- **Auth**: server-side sessions, DB-backed — local credentials (email confirmation on signup) or "Sign in with GitHub" (OAuth 2.0, auto-registers on first use); an already-local account can also just *link* GitHub afterwards for widget authorization without changing how it logs in
- **Refresh**: in-process scheduler (`@nestjs/schedule`), no external job queue

For the technical architecture, the `ServiceProvider` contract, the data model, diagrams, the testing
approach, and the technology-choice justification (decision matrix), see
[ARCHITECTURE.md](./docs/ARCHITECTURE.md). For the full list of HTTP endpoints (what the frontend calls),
see [API.md](./docs/API.md). For local dev setup, adding a new service, and commit conventions, see
[CONTRIBUTING.md](./docs/CONTRIBUTING.md). Hit something weird? Check
[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) — it's real issues hit while building this, not hypothetical
ones. What data this app collects and why: [PRIVACY.md](./docs/PRIVACY.md). What was tested and fixed for
keyboard/screen-reader use, and what wasn't: [ACCESSIBILITY.md](./docs/ACCESSIBILITY.md). Team organization, a
dated timeline of what got built and decided, and what's left: [PROJECT_LOG.md](./docs/PROJECT_LOG.md).

## Testing

```bash
cd backend
npm test          # unit tests (Jest)
npm run test:cov  # with coverage
```

See [ARCHITECTURE.md#testing](./docs/ARCHITECTURE.md#testing) for exactly what's covered and, just as
important, what isn't and why.

## TODO

- [x] Backend: accounts, sessions, `TimerModule` scheduler, `WidgetsModule`, `AdminModule`, `/about.json`
- [x] Every service and widget in the table above, all backed by real external APIs (10 services, 23 widgets)
- [x] OAuth 2.0 (GitHub, and Microsoft/My Epitech via OIDC — GitHub's grant is properly revoked on unlink,
      so reconnecting doesn't silently reuse the old account)
- [x] Frontend: the full "Morex" design (`frontend/public/mockups.html`) applied and wired to the real API —
      themes, widget skins, journal, avatar editor (DiceBear + photo upload), i18n (EN/FR/ES)
- [x] Every widget surfaces the exact reason its last refresh failed (`lastError`) instead of an
      indefinite "waiting for data" — a 404, a rate limit, an empty RSS feed, a disconnected account
- [x] Type-ahead suggestions on (almost) every widget field, real back-and-forth widget-creation chat, and
      a documentation help chat that also handles small talk naturally
- [x] Exporting your own data as JSON, deleting your own account
- [x] Unit tests for the backend's business logic (470+ tests), architecture diagrams, API reference,
      contributor guide, troubleshooting doc, privacy note, dated project log
- [ ] Get the app declared by Epitech staff (OIDC client id/secret) — needed before "Connect with My Epitech" works; not something we control
- [ ] Services: Maps/Cinema — not built; the brief's list is explicitly "non-exhaustive" and the minimum
      (services/widgets) is already well exceeded
- [x] Frontend: Terms of Service/Privacy Policy acceptance at sign-up (`/terms`, `/privacy`, checked both
      client- and server-side), a dedicated in-app Help Center (`/help`, searchable, grouped by kind)
