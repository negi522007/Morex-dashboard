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

## Technologies

- **Backend**: Node.js / NestJS + Prisma + PostgreSQL
- **Frontend**: React + Tailwind + react-grid-layout
- **Auth**: server-side sessions, DB-backed (local credentials + email confirmation on signup) + OAuth 2.0 (GitHub, for widget authorization/linking)
- **Refresh**: in-process scheduler (`@nestjs/schedule`), no external job queue

For the technical architecture, the `ServiceProvider` contract, the data model, diagrams, the testing
approach, and the technology-choice justification (decision matrix), see
[ARCHITECTURE.md](./ARCHITECTURE.md). For the full list of HTTP endpoints (what the frontend calls),
see [API.md](./API.md).

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
- [ ] Services: Weather, Steam, Maps/Cinema
- [ ] Bootstrap the React app (`frontend/`) and the dashboard UI
