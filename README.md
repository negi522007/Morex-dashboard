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
| Market data (crypto) | No | ✅ Done | `exchange_rate` (base, quote), `price_history` (asset, days, currency) |
| GitHub | OAuth 2.0 | ✅ Done | `recent_commits` (repo, number), `open_issues` (repo, number), `repo_stats` (repo) |
| Weather | No | ⏳ Not started | — |
| Steam | API key | ⏳ Not started | — |
| Maps / Cinema | API key | ⏳ Not started | — |

The exact list currently live (names, descriptions, parameters) is always exposed dynamically by the
server at `GET /about.json` — this table can drift, that endpoint can't.

## Install & run

```bash
cp .env.example .env   # fill in secrets (SMTP if not using the bundled Mailhog, GitHub OAuth, token encryption key...)
docker compose build
docker compose up
```

The server listens on `http://localhost:8080`. Quick check:

```bash
curl http://localhost:8080/about.json
```

## How to use it

There's no frontend yet (see TODO), so this is a walkthrough with `curl` — the exact same requests a
future UI would make. Full endpoint reference: [API.md](./API.md).

**1. Create an account and confirm it.**
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-real-password"}'
```
Open `http://localhost:8025` (Mailhog's inbox, bundled — no real email needed in dev) and click the
confirmation link, or grab the link's `token` and hit it directly:
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
- **Auth**: server-side sessions, DB-backed (local credentials + email confirmation on signup) + OAuth 2.0 (GitHub, for widget authorization/linking)
- **Refresh**: in-process scheduler (`@nestjs/schedule`), no external job queue

For the technical architecture, the `ServiceProvider` contract, the data model, diagrams, the testing
approach, and the technology-choice justification (decision matrix), see
[ARCHITECTURE.md](./ARCHITECTURE.md). For the full list of HTTP endpoints (what the frontend calls),
see [API.md](./API.md). For local dev setup, adding a new service, and commit conventions, see
[CONTRIBUTING.md](./CONTRIBUTING.md). Hit something weird? Check
[TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — it's real issues hit while building this, not hypothetical
ones.

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
- [x] `AuthModule`: signup, email confirmation, session login/logout, GitHub OAuth linking
- [x] `TimerModule`: refresh scheduler
- [x] `WidgetsModule`: add/reconfigure/move/delete widget instances
- [x] Services: RSS, Market data, GitHub
- [x] Unit tests for the backend's business logic
- [x] API reference ([API.md](./API.md))
- [x] Architecture diagrams (module graph, ER diagram, sequence diagrams)
- [x] Non-technical user-facing section
- [x] Usage walkthrough, contributor guide, and troubleshooting doc
- [ ] Services: Weather, Steam, Maps/Cinema
- [ ] Bootstrap the React app (`frontend/`) and the dashboard UI
