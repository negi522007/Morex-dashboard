# Dashboard

> Status: work in progress. This README will be completed as the project progresses (see TODO below).

## Overview

A customizable web dashboard: users sign up, subscribe to services (GitHub, Steam, weather, RSS, ...),
then build their own dashboard by adding, configuring, and moving widgets. Each widget refreshes
automatically at a user-defined interval.

## Planned services & widgets

| Service | Auth required | Widgets (indicative) |
|---|---|---|
| Weather | No | sky overview, temperature |
| RSS | No | article list |
| Market data (crypto) | No | price history, exchange rate |
| GitHub | OAuth 2.0 | recent commits, security alerts |
| Steam | API key | most played games, news feed |
| Maps / Cinema | API key | directions / today's screenings |

The final list (exact names, descriptions, parameters) is exposed dynamically by the server at
`GET /about.json`.

## Install & run

```bash
cp .env.example .env   # fill in secrets (JWT, SMTP, GitHub OAuth...)
docker-compose build
docker-compose up
```

The server listens on `http://localhost:8080`. Quick check:

```bash
curl http://localhost:8080/about.json
```

## Technologies

- **Backend**: Node.js / NestJS + Prisma + PostgreSQL
- **Frontend**: React + Tailwind + react-grid-layout
- **Auth**: server-side sessions, DB-backed (local credentials + email confirmation on signup) + OAuth 2.0 (GitHub)
- **Refresh**: in-process scheduler (`@nestjs/schedule`), no external job queue

For the technical architecture, the `ServiceProvider` contract, the data model, and the
technology-choice justification (decision matrix), see [ARCHITECTURE.md](./ARCHITECTURE.md).

## TODO

- [ ] Bootstrap the actual NestJS app (`backend/`) and React app (`frontend/`)
- [ ] Implement Phase 1 modules (auth, widgets, timer, about)
- [ ] Implement the 6 services / 10+ widgets (Phase 2)
- [ ] Non-technical user-facing section
- [ ] Architecture diagram
