# Dashboard

> Status: work in progress. This README will be completed as the project progresses (see TODO below).

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

A customizable web dashboard: users sign up, subscribe to services (GitHub, Steam, weather, RSS, ...),
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
| Steam | Server API key (`STEAM_API_KEY`) | ✅ Done | `profile`, `recent_games`, `library_stats` (steamId — public profiles) |
| Maps / Cinema | API key | ⏳ Not started | — |

**Beyond widgets** (all documented in [API.md](./API.md)): a **well-being page** (daily quote, horoscope, breathing exercises, tips, mood streak), an "Is this you?" **confirmation page** with a "not me" option, **sign-in with a school Microsoft account**, a **help assistant** that explains the app, each service and the technical vocabulary in plain words (English/French/Spanish, works with or without AI), optional **AI** (article recaps with images,
per-widget insights, a daily brief, a natural-language widget assistant — off unless `AI_PROVIDER`/`AI_API_KEY`
are set, opt-in per widget, never touches the journal), **threshold alerts** (in-app + email), **value
history** for charts, a **read-only public share link**, and **SSRF protection** on every user-supplied URL
the server fetches. Not built, on purpose: Google Photos and Epitech student data (credits/XP) — reasons in
API.md.

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

See [FRONTEND.md](./FRONTEND.md) for what's built there (routes, the dev proxy, what isn't yet).

## How to use it

The walkthrough below uses `curl` directly against the API — useful to understand the contract or debug
independently of the UI. For the actual app, use the frontend at `http://localhost:5173` instead; it
makes these exact same requests. Full endpoint reference: [API.md](./API.md).

**1. Create an account and confirm it.** (`firstName`/`lastName` are required; editable later via
`PATCH /auth/me`.)
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-real-password","firstName":"Ada","lastName":"Lovelace"}'
```
By default this lands in **Mailhog** (`http://localhost:8025`), not a real inbox — see
[CONTRIBUTING.md](./CONTRIBUTING.md#sending-real-confirmation-emails-not-just-to-mailhog) to configure
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
[ARCHITECTURE.md](./ARCHITECTURE.md). For the full list of HTTP endpoints (what the frontend calls),
see [API.md](./API.md). For local dev setup, adding a new service, and commit conventions, see
[CONTRIBUTING.md](./CONTRIBUTING.md). Hit something weird? Check
[TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — it's real issues hit while building this, not hypothetical
ones. What data this app collects and why: [PRIVACY.md](./PRIVACY.md). Team organization, a dated
timeline of what got built and decided, and what's left: [PROJECT_LOG.md](./PROJECT_LOG.md).

## Testing

```bash
cd backend
npm test          # unit tests (Jest)
npm run test:cov  # with coverage
```

See [ARCHITECTURE.md#testing](./ARCHITECTURE.md#testing) for exactly what's covered and, just as
important, what isn't and why.

## TODO

- [x] Bootstrap the NestJS app (`backend/`), Prisma, and a working `/about.json`
- [x] `AuthModule`: signup, email confirmation, session login/logout, GitHub OAuth linking, "Sign in with GitHub"
- [x] `TimerModule`: refresh scheduler
- [x] `WidgetsModule`: add/reconfigure/move/delete widget instances
- [x] Services: RSS, Market data, GitHub
- [x] Unit tests for the backend's business logic
- [x] API reference ([API.md](./API.md))
- [x] Architecture diagrams (module graph, ER diagram, sequence diagrams)
- [x] Non-technical user-facing section
- [x] Usage walkthrough, contributor guide, and troubleshooting doc
- [x] Bootstrap the React app (`frontend/`): auth pages (login/register), protected dashboard route
- [x] Widget dashboard UI: add/reconfigure/move/resize/delete, backed by the real API (see [FRONTEND.md](./FRONTEND.md))
- [x] `AdminModule`: list/edit/ban/unban/delete users — not required by the brief, built anyway
- [x] Profile editing: `PATCH /auth/me` (self: name, password) and `PATCH /admin/users/:id` (admin: name, emailVerified)
- [x] GitHub repo picker: `GET /services/github/repos` + `WidgetParam.optionsUrl` contract
- [x] Live API docs ([Swagger UI](http://localhost:8080/docs) once the server is running), generated from the code
- [x] Privacy note ([PRIVACY.md](./PRIVACY.md)) — plain-language, not fabricated legal text
- [x] Project log: team organization, a dated decision timeline, what's left ([PROJECT_LOG.md](./PROJECT_LOG.md))
- [x] Weather service (Open-Meteo)
- [x] Backend: AI enrichment, calendar/Epitech/custom-API services, alerts, history, share link, My Epitech OIDC, SSRF guard (see API.md; frontend adaptation checklist at the end of it)
- [ ] Get the app declared by Epitech staff (OIDC client id/secret) — needed before "Connect with My Epitech" works
- [x] Steam service
- [x] Backend: "Is this you?" confirmation page, birth date at sign-up, well-being data (quote, horoscope, breathing, tips, moods), Microsoft sign-in (see API.md)
- [ ] Services: Maps/Cinema
- [ ] Frontend: apply the Morex mockup (`frontend/public/mockups.html`) — Morayo; the backend side is done, see "Backing the Morex mockup" in [API.md](./API.md)
- [ ] Frontend: Terms of Service/Privacy Policy acceptance, in-app docs page
