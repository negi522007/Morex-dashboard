# Architecture

Technical documentation for developers/contributors. For a general overview (install, usage, feature
list), see [README.md](./README.md).

## Directory layout

```
/backend
  /src
    /auth        # signup, email confirmation, session login/logout, GitHub OAuth + linking
    /mail        # SMTP sending (Mailhog in dev, a real provider in prod)
    /prisma      # PrismaService/PrismaModule (the DB client, not the schema itself)
    /services
      service-provider.interface.ts   # the ServiceProvider/WidgetDefinition contract
      service-providers.token.ts      # DI token for the registry
      services.module.ts              # wires every concrete provider into the registry
      /rss           # done
      /market-data   # done
      /github        # done
      /weather       # not started (Morayo)
      /steam         # not started (Morayo)
      /maps          # not started (Morayo)
    /widgets     # widget instance CRUD (add/reconfigure/move/delete)
    /timer       # refresh scheduler
    /about       # generates GET /about.json from the registered ServiceProviders
    /common      # cross-cutting utils (token encryption)
  prisma/
    schema.prisma
    migrations/
/frontend          # not started (Morayo)
  /src
    /components
    /pages
    /hooks
/bonus
docker-compose.yml
```

There is no `/admin` module (user management) yet — the brief lists it as useful, not mandatory, and
nothing in the current scope has needed it.

## Module graph

Solid arrows are Nest module imports; dashed arrows are "injects a provider from a `@Global` module
without importing it" (`PrismaModule` and `ServicesModule` are both `@Global`, so `TimerModule` and
`AboutModule` use `PrismaService`/`SERVICE_PROVIDERS` without listing those modules in their own
`imports`).

```mermaid
graph TD
    AppModule --> ConfigModule
    AppModule --> ScheduleModule
    AppModule --> PrismaModule["PrismaModule (Global)"]
    AppModule --> ServicesModule["ServicesModule (Global)"]
    AppModule --> AboutModule
    AppModule --> AuthModule
    AppModule --> TimerModule
    AppModule --> WidgetsModule

    AuthModule --> MailModule
    WidgetsModule -->|imports, for SessionGuard| AuthModule

    ServicesModule --> RssModule
    ServicesModule --> MarketDataModule
    ServicesModule --> GithubModule

    AboutModule -.->|SERVICE_PROVIDERS| ServicesModule
    TimerModule -.->|SERVICE_PROVIDERS| ServicesModule
    TimerModule -.->|PrismaService| PrismaModule
    WidgetsModule -.->|SERVICE_PROVIDERS + PrismaService| ServicesModule
    AuthModule -.->|PrismaService| PrismaModule
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

```mermaid
erDiagram
    User ||--o{ Session : has
    User ||--o{ EmailVerificationToken : has
    User ||--o{ OAuthAccount : has
    User ||--o{ ServiceSubscription : has
    User ||--o{ WidgetInstance : has

    User {
        string id PK
        string email UK
        string passwordHash "nullable"
        boolean emailVerified
    }
    Session {
        string id PK "the session cookie value"
        string userId FK
        datetime expiresAt
    }
    EmailVerificationToken {
        string id PK
        string token UK
        string userId FK
        datetime expiresAt
    }
    OAuthAccount {
        string id PK
        string provider
        string providerAccountId
        string accessTokenEncrypted
        string userId FK
    }
    ServiceSubscription {
        string id PK
        string serviceName
        string credentialsEncrypted "nullable"
        string userId FK
    }
    WidgetInstance {
        string id PK
        string serviceName
        string widgetName
        json config
        int refreshRateSeconds
        json position
        datetime lastRefreshedAt "nullable"
        json cachedData "nullable"
        string userId FK
    }
```

- **User** — platform account. `passwordHash` is nullable (an account can be created via OAuth only),
  `emailVerified` blocks login until confirmation has happened.
- **Session** — a server-side session record; its `id` is the unguessable value stored in the login
  cookie. Deleting a row logs that session out immediately (see Authentication below).
- **EmailVerificationToken** — time-limited token for signup email confirmation.
- **OAuthAccount** — a third-party account linked to a `User`. Linking is resolved by matching the
  provider's verified email against an existing `User`, never by auto-creating a duplicate. Tokens are
  stored encrypted (`accessTokenEncrypted`/`refreshTokenEncrypted`), never in plaintext.
- **ServiceSubscription** — a non-OAuth service subscription (plain credentials), also encrypted at rest.
- **WidgetInstance** — one widget instance placed on a user's dashboard: `config` (validated against the
  `WidgetDefinition`'s `params`), `refreshRateSeconds`, `position` (for react-grid-layout), `cachedData` +
  `lastRefreshedAt` (last result cached by the scheduler).

## Widgets (add / reconfigure / move / delete)

File: `backend/src/widgets/widgets.service.ts`. Every route is behind `SessionGuard` and scoped to the
caller: every mutation does `findFirst({ id, userId })` first, so a widget instance belonging to another
user 404s instead of leaking whether it exists. Reconfigure and move share one `PATCH` endpoint — both
are just "update mutable fields on an existing instance."

```mermaid
sequenceDiagram
    actor U as User (logged in)
    participant C as Client
    participant W as WidgetsController
    participant S as WidgetsService
    participant DB as Postgres

    U->>C: pick service+widget, fill config, set refresh rate
    C->>W: POST /widgets {serviceName, widgetName, config, refreshRateSeconds}
    Note over W: SessionGuard confirms the user first
    W->>S: create(userId, body)
    S->>S: look up the provider+widget in SERVICE_PROVIDERS
    alt unknown service/widget
        S-->>W: 400 Bad Request
    else known widget
        S->>S: validate config against widget.params
        alt missing/invalid param
            S-->>W: 400 Bad Request
        else config valid
            S->>S: validate refreshRateSeconds >= 10
            opt provider.requiresAuth
                S->>DB: check an OAuthAccount / ServiceSubscription exists
                alt no credentials linked
                    S-->>W: 400 Bad Request
                end
            end
            S->>DB: create WidgetInstance
            S-->>W: the new instance
            W-->>C: 201 Created
        end
    end
```

## Scheduler (Timer)

No external job queue (Redis/BullMQ): judged disproportionate at this project's scale (2 devs, a few
dozen instances) and contrary to the brief's advice to avoid over-engineering. Instead:
`@nestjs/schedule` with an internal tick that scans `WidgetInstance` rows where
`lastRefreshedAt + refreshRateSeconds <= now`, triggers `fetchData` via the matching `ServiceProvider`,
and updates `cachedData`. The frontend reads this cache (lightweight per-instance polling), no WebSocket.

This choice stays isolated behind the `ServiceProvider` contract: if a scalability need appears later,
the scheduler can be swapped without touching the services themselves.

```mermaid
sequenceDiagram
    participant T as TimerService (@Interval 15s)
    participant DB as Postgres
    participant P as ServiceProvider (e.g. RssProvider)
    participant Ext as External API

    loop every 15s
        alt previous tick still running
            T->>T: log a warning, skip this tick
        else
            T->>DB: SELECT due WidgetInstance rows
            loop for each due instance
                T->>T: find the matching provider/widget
                alt unknown service/widget
                    T->>DB: update lastRefreshedAt only
                else known widget
                    opt provider.requiresAuth
                        T->>DB: look up OAuthAccount / ServiceSubscription
                        T->>T: decrypt the token/credentials
                    end
                    T->>P: fetchData(config, auth)
                    P->>Ext: HTTP request (10s timeout)
                    alt success
                        Ext-->>P: data
                        P-->>T: normalized result
                        T->>DB: update cachedData + lastRefreshedAt
                    else failure (timeout, non-2xx, parse error)
                        P-->>T: throws ServiceFetchError
                        T->>T: log the error
                        T->>DB: update lastRefreshedAt only (cachedData kept as-is)
                    end
                end
            end
        end
    end
```

## Authentication & authorization

Two distinct mechanisms, as required by the brief:
- **Authentication**: server-side sessions on local credentials (email + hashed password), with
  mandatory signup email confirmation before any login — **not JWT**. On login, the server creates a
  `Session` row and sends its `id` back as an `httpOnly` + `SameSite=Lax` cookie (`Secure` too, once the
  app is served over HTTPS — gated by `COOKIE_SECURE`, not `NODE_ENV`, since a browser silently drops
  `Secure` cookies over plain HTTP and docker-compose has no TLS termination today). Every request looks
  the session up server-side; nothing is trusted purely on the client's say-so.
- **Authorization**: OAuth 2.0 (GitHub for now) to let a widget access a third-party API on the user's
  behalf. A user already registered locally must be able to *link* their GitHub account afterwards (not
  only log in via GitHub); on an OAuth login whose email matches an existing account, link to that
  existing account rather than creating a new one.

### Registration & email confirmation

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client
    participant A as AuthController
    participant S as AuthService
    participant DB as Postgres
    participant M as MailService (SMTP)

    C->>A: POST /auth/register {email, password}
    A->>S: register(email, password)
    S->>DB: findUnique(email)
    alt email already taken
        S-->>A: 409 Conflict
    else email available
        S->>S: hashPassword() (scrypt)
        S->>DB: create User (emailVerified=false)
        S->>DB: create EmailVerificationToken
        S->>M: sendConfirmationEmail(link)
        alt SMTP send fails
            M-->>S: error
            S->>DB: delete User (cascade deletes the token)
            S-->>A: 503 Service Unavailable
        else SMTP send succeeds
            S-->>A: {id, email}
            A-->>C: 201 Created
        end
    end
    C->>A: GET /auth/confirm?token=... (user clicked the emailed link)
    A->>S: confirmEmail(token)
    S->>DB: findUnique(token)
    alt token unknown or expired
        S-->>A: 401 Unauthorized
    else token valid
        S->>DB: transaction: user.emailVerified=true + delete token
        S-->>A: ok
        A-->>C: 200 "Email confirmed"
    end
```

### Login

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client (browser)
    participant A as AuthController
    participant S as AuthService
    participant DB as Postgres

    U->>C: submit login form
    C->>A: POST /auth/login {email, password}
    A->>S: login(email, password)
    S->>DB: findUnique(email)
    alt no user, or wrong password
        S-->>A: 401 Unauthorized
    else email not verified yet
        S-->>A: 403 Forbidden
    else credentials correct and verified
        S->>DB: create Session (expiresAt = now + 7d)
        S-->>A: {session, user}
        A-->>C: 200 OK + Set-Cookie dashboard_session=... (HttpOnly, SameSite=Lax)
    end
    Note over C: Every later request sends the cookie back automatically
```

### GitHub OAuth linking

```mermaid
sequenceDiagram
    actor U as User (already logged in)
    participant C as Client (browser)
    participant G as GithubOAuthController
    participant GH as github.com
    participant S as AuthService
    participant DB as Postgres

    U->>C: click "Connect GitHub"
    C->>G: GET /auth/github (session cookie sent)
    Note over G: SessionGuard confirms the user first
    G->>G: generate random state, Set-Cookie github_oauth_state
    G-->>C: 302 redirect to github.com/login/oauth/authorize
    C->>GH: follow redirect
    U->>GH: log in + approve
    GH-->>C: 302 redirect to /auth/github/callback?code=...&state=...
    C->>G: GET /auth/github/callback (session cookie + state cookie sent)
    G->>G: compare state cookie vs query param
    alt state mismatch or missing
        G-->>C: 400 Bad Request
    else state OK
        G->>S: linkGithubAccount(userId, code)
        S->>GH: POST /login/oauth/access_token
        GH-->>S: access_token
        S->>GH: GET /user (Bearer token)
        GH-->>S: profile {id, login}
        S->>S: encryptToken(access_token)
        S->>DB: findUnique OAuthAccount(provider, providerAccountId)
        alt already linked to a different user
            S-->>G: 409 Conflict
        else free to link
            S->>DB: create or update OAuthAccount
            S-->>G: ok
        end
        G-->>C: 200 "GitHub account linked"
    end
```

### Why sessions instead of JWT

JWT was the default in the original proposal, carried over by convention rather than evaluated against
this project's actual constraints. On reconsideration, sessions fit better here:

- **No scaling need**: the app runs as a single `server` container — JWT's main advantage (no shared
  session store across instances) doesn't apply.
- **Instant revocation**: the brief calls for an admin section to manage users. Banning someone must take
  effect immediately — trivial with sessions (delete the `Session` row), not natively possible with a
  bare JWT (would need a `tokenVersion`/refresh-token workaround that reintroduces server-side state
  anyway, cancelling JWT's main benefit).
- **Equivalent security, less complexity**: a JWT stored safely (httpOnly cookie) ends up with the same
  security properties as a session cookie, without the extra machinery of signing/expiry/refresh — so
  sessions win on simplicity for no security cost. A `Session` row in Postgres (rather than in-memory)
  also survives server restarts.
- No requirement in the brief needs a non-browser client (mobile app, third-party API consumer) for
  which JWT's statelessness would matter — designing for that hypothetical would be over-engineering.

## Security

- No secrets committed: `.env` is gitignored, `.env.example` documents the expected variables.
- OAuth tokens and service credentials are encrypted at rest, never in plaintext.
- External fetcher errors are never exposed as-is to the end user (no stack traces).

## Testing

Unit tests live next to the code they cover, as `*.spec.ts` files (Jest + `ts-jest`). Run them from
`backend/`:

```bash
npm test          # run once
npm run test:cov  # with a coverage report
```

**What's covered — business logic, with every external call mocked (no real network, no real DB):**

- `password.util` / `token-encryption.util` — hashing/verification and AES-256-GCM round-trips, including
  a wrong key and a tampered payload both failing closed.
- Every `ServiceProvider` (`rss`, `market_data`, `github`) — `global.fetch` is mocked with realistic
  response shapes (RSS 2.0, Atom, CoinGecko, GitHub's REST responses) to check parsing/normalization, and
  with failure shapes (non-2xx, network rejection, malformed payload) to check every failure path raises
  `ServiceFetchError` rather than a raw exception.
- `AuthService` — register (incl. the rollback when the confirmation email fails to send), confirmEmail,
  login, logout, `linkGithubAccount` (new link, re-link by the same user, conflict when another user
  already owns that GitHub identity, GitHub error responses).
- `SessionGuard` — missing cookie, stale/unknown session, valid session attaching `req.user`.
- `WidgetsService` — config validation against a widget's declared `params`, the `requiresAuth` precheck,
  and ownership scoping on update/remove (a widget instance belonging to another user 404s).
- `TimerService` — a due instance being fetched and cached, a failing widget keeping its last-known-good
  `cachedData` while still advancing `lastRefreshedAt`, an unknown service/widget not crashing the loop,
  auth resolution (`OAuthAccount` then `ServiceSubscription`, both decrypted), and two overlapping ticks
  not running concurrently.
- `AboutService` — the exact shape served at `/about.json`, including that `requiresAuth` and `fetchData`
  never leak into the public response.

83 tests across 10 suites, all passing, as of this writing.

**What's deliberately NOT covered by these unit tests, and why:** controllers are left untested directly
— they're thin delegators to the services above, so testing them would mostly re-test NestJS's own
routing rather than our logic. Real Postgres queries, the real Docker build, the real GitHub OAuth
consent screen, and real SMTP delivery were all verified by hand against live systems during development
(see the corresponding commit messages for exactly what was run and what it returned) rather than
automated — a full integration/e2e harness (a disposable test database, a fake GitHub OAuth server, ...)
was judged out of scope given the project's size and timeline. That remains a legitimate next step, not
a silently skipped one.

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

*Validated by the team: Morayo reviewed and agreed with this stack and architecture after filling their
own matrix independently.*
