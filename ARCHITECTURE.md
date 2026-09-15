# Architecture

Technical documentation for developers/contributors. For a general overview (install, usage, feature
list), see [README.md](./README.md).

## Directory layout

```
/backend
  /src
    /auth        # signup, email confirmation, JWT login, GitHub OAuth + linking
    /services
      /weather
      /github
      /rss
    /widgets     # widget instance CRUD (add/reconfigure/move/delete)
    /timer       # refresh scheduler
    /admin       # user management
    /about       # generates GET /about.json from the registered ServiceProviders
  prisma/schema.prisma
/frontend
  /src
    /components
    /pages
    /hooks
/bonus
docker-compose.yml
```

## `ServiceProvider` / `WidgetDefinition` contract

File: `backend/src/services/service-provider.interface.ts`.

Each service (weather, github, rss, ...) implements `ServiceProvider`: it declares its name, whether it
requires authentication, and its list of `WidgetDefinition`s (name, description, configurable params,
`fetchData` function). `GET /about.json` is generated automatically by iterating over the registered
`ServiceProvider`s — no duplication between the API doc and the code.

`fetchData` must never let a raw exception leak: any external call failure must be converted into a
`ServiceFetchError` (typed, carrying `serviceName`/`widgetName`), caught by the scheduler so it marks the
instance as errored without crashing the global tick or the other widgets.

## Data model (Prisma)

File: `backend/prisma/schema.prisma`.

- **User** — platform account. `passwordHash` is nullable (an account can be created via OAuth only),
  `emailVerified` blocks login until confirmation has happened.
- **EmailVerificationToken** — time-limited token for signup email confirmation.
- **OAuthAccount** — a third-party account linked to a `User`. Linking is resolved by matching the
  provider's verified email against an existing `User`, never by auto-creating a duplicate. Tokens are
  stored encrypted (`accessTokenEncrypted`/`refreshTokenEncrypted`), never in plaintext.
- **ServiceSubscription** — a non-OAuth service subscription (plain credentials), also encrypted at rest.
- **WidgetInstance** — one widget instance placed on a user's dashboard: `config` (validated against the
  `WidgetDefinition`'s `params`), `refreshRateSeconds`, `position` (for react-grid-layout), `cachedData` +
  `lastRefreshedAt` (last result cached by the scheduler).

## Scheduler (Timer)

No external job queue (Redis/BullMQ): judged disproportionate at this project's scale (2 devs, a few
dozen instances) and contrary to the brief's advice to avoid over-engineering. Instead:
`@nestjs/schedule` with an internal tick that scans `WidgetInstance` rows where
`lastRefreshedAt + refreshRateSeconds <= now`, triggers `fetchData` via the matching `ServiceProvider`,
and updates `cachedData`. The frontend reads this cache (lightweight per-instance polling), no WebSocket.

This choice stays isolated behind the `ServiceProvider` contract: if a scalability need appears later,
the scheduler can be swapped without touching the services themselves.

## Authentication & authorization

Two distinct mechanisms, as required by the brief:
- **Authentication**: JWT on local credentials (email + hashed password), with mandatory signup email
  confirmation before any login.
- **Authorization**: OAuth 2.0 (GitHub for now) to let a widget access a third-party API on the user's
  behalf. A user already registered locally must be able to *link* their GitHub account afterwards (not
  only log in via GitHub); on an OAuth login whose email matches an existing account, link to that
  existing account rather than creating a new one.

## Security

- No secrets committed: `.env` is gitignored, `.env.example` documents the expected variables.
- OAuth tokens and service credentials are encrypted at rest, never in plaintext.
- External fetcher errors are never exposed as-is to the end user (no stack traces).

## Technology choices — Decision Matrix

| Criterion | Weight | Node.js | Python | Java | React | Vue | Angular |
|---|---|---|---|---|---|---|---|
| Team experience | 3 | 4 | 3 | 2 | 5 | 3 | 2 |
| Ecosystem / libraries | 3 | 5 | 4 | 3 | 5 | 4 | 3 |
| Docker deployment complexity | 2 | 5 | 4 | 2 | 4 | 4 | 3 |
| OAuth tooling maturity | 2 | 5 | 4 | 3 | 4 | 3 | 3 |
| Suitability for scheduled refresh | 1 | 5 | 4 | 3 | 4 | 4 | 3 |
| Community support / longevity | 1 | 5 | 5 | 4 | 5 | 4 | 4 |
| Learning value | 1 | 4 | 3 | 3 | 4 | 3 | 3 |
| **Weighted total** | | **61** | **49** | **35** | **59** | **46** | **37** |

**Node.js/NestJS** and **React** were selected. Deciding criteria: ecosystem (NestJS naturally structures
the `ServiceProvider` pattern by module; React has `react-grid-layout`) and team experience (a single
language, TypeScript, end to end). Accepted trade-off: Node.js is single-threaded, less suited than a JVM
to parallel CPU-intensive work — accepted because the actual workload is I/O-bound API aggregation, a
case where the event loop excels; to be revisited only if heavy processing appears later.

*Current fill = Person A's independent scoring only. Pending Person B's independent fill and a comparison
of the gaps before treating this choice as fully validated by the team.*
