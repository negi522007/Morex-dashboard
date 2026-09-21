# Contributing

Practical guide for working on this repo day to day — not the "why" (see
[ARCHITECTURE.md](./ARCHITECTURE.md)), not "what does the API look like" (see [API.md](./API.md)), just
"how do I actually make a change."

## Local development without rebuilding the Docker image every time

`docker compose up` rebuilds/restarts the whole server on every change, which is slow while actively
coding. Instead, run only the dependencies in Docker and the server directly on your machine:

```bash
docker compose up -d db mailhog
cd backend
npm install
npm run start:dev   # watches for changes, restarts automatically
```

This needs its own `backend/.env` (a plain `npm run start:dev` doesn't go through
`docker-compose.yml`'s `environment:` overrides, so nothing points at the `db`/`mailhog` container
hostnames automatically). Copy the root `.env.example` into `backend/.env` and adjust three values to
reach the containers from the host instead of from inside the Docker network:

```bash
DATABASE_URL=postgresql://dashboard:dashboard@localhost:55432/dashboard
SMTP_HOST=localhost
SMTP_PORT=1025
```

(`55432` and `1025` are the host-published ports from `docker-compose.yml` — not `5432`/the container's
internal port.) Everything else in `.env.example` (`TOKEN_ENCRYPTION_KEY`, `GITHUB_CLIENT_ID`, ...) works
the same either way.

Run the migration once against that same database before starting the server:
```bash
npx prisma migrate dev
```

## Running the tests

```bash
cd backend
npm test          # once
npm run test:watch
npm run test:cov  # with a coverage report
```

See [ARCHITECTURE.md#testing](./ARCHITECTURE.md#testing) for what's covered and what isn't.

## Adding a new service (Weather, Steam, Maps/Cinema, ...)

This is the one piece of onboarding that actually matters for this project — every service follows the
exact same shape, so once you've done it once it's mechanical:

1. Create `backend/src/services/<name>/<name>.provider.ts`. Export an `@Injectable()` class implementing
   `ServiceProvider` (from `../service-provider.interface`): a `name`, a `requiresAuth` boolean, and a
   `widgets` array of `WidgetDefinition`s. Each widget declares its `params` (`name`, `type`: `'string'`
   or `'integer'`, `required?`) and a `fetchData(config, auth?)` that returns the widget's data.
   - **Never let a raw error escape `fetchData`.** Wrap every failure (network error, non-2xx response,
     bad/missing param, unparseable payload) in a `ServiceFetchError(serviceName, widgetName, message)`
     — see `rss.provider.ts` or `github.provider.ts` for the pattern (a small `fetchJson`/`githubGet`
     helper with a 10s `AbortController` timeout, used by every widget in that file).
   - If `requiresAuth` is `true`, `fetchData`'s second argument may be `{ accessToken }` (from a linked
     `OAuthAccount`) or `{ credentials }` (from a `ServiceSubscription`) — see how `github.provider.ts`
     uses `auth?.accessToken`. It can also be `undefined` (no credentials linked yet, or the service just
     doesn't require any) — handle that case explicitly, don't assume it's always present.
2. Create `<name>.module.ts` right next to it — copy `rss.module.ts`, it's always the same three lines
   (provide + export the provider class).
3. Register it in `backend/src/services/services.module.ts`: import the new module, add the provider
   class to the factory's parameters and to the returned array. That's the only file every service has
   to touch — everything else (`/about.json`, the scheduler, widget creation/validation) reads from this
   registry automatically.
4. Write a `<name>.provider.spec.ts` next to it, mocking `global.fetch` with a realistic response shape
   for the real API you're calling, and at least one failure shape (non-2xx, malformed payload) — copy
   the structure of `market-data.provider.spec.ts`, it's the simplest of the three existing ones.
5. Rebuild and actually test it against the real external API before committing — seed a `WidgetInstance`
   row (`INSERT INTO "WidgetInstance" ...` via `docker compose exec db psql ...`, or once the frontend
   exists, add it through the UI) and check `cachedData` after the scheduler's next tick (up to 15s). Unit
   tests catch logic bugs; they won't catch "I got the real API's response shape wrong."

## Commit conventions

- English, `type(scope): summary` (`feat(auth): ...`, `fix(timer): ...`, `docs: ...`, `test: ...`,
  `chore: ...`) — look at recent history for the tone: the body explains *why*, not a restatement of the
  diff.
- No AI-attribution trailers (`Co-Authored-By: Claude`, `Claude-Session:`, ...) in any commit, per the
  team's global convention.
- Test what you're committing for real before committing it — against the actual running app (Docker or
  `start:dev`), not just "the code compiles."

## Environment variables

See `.env.example` at the repo root for the full list with inline comments; the short version:

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Always |
| `APP_URL` | Used to build the email confirmation link | Always |
| `SESSION_COOKIE_NAME` | Name of the session cookie | Has a default |
| `COOKIE_SECURE` | `"true"` only once served over real HTTPS | Has a default (`false`) |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex key (`openssl rand -hex 32`) for encrypting stored OAuth tokens/credentials | Always, once any auth-requiring service is used |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Outgoing mail | Defaults point at the bundled Mailhog — real delivery needs real values (see below) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_OAUTH_CALLBACK_URL` | GitHub OAuth App credentials | Only for the GitHub linking flow |

### Sending real confirmation emails (not just to Mailhog)

`docker-compose.yml` does **not** force `SMTP_HOST`/`SMTP_PORT` — whatever is in your `.env` is what the
server actually uses, so pointing it at a real provider works with no code changes. Fastest option if
you already have a Gmail account, no third-party signup needed:

1. Turn on 2-Step Verification: <https://myaccount.google.com/security>
2. Generate an app password: <https://myaccount.google.com/apppasswords> (name it anything, e.g.
   "Dashboard")
3. Set in `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=you@gmail.com
   SMTP_PASSWORD=<the 16-character app password, no spaces>
   SMTP_FROM=you@gmail.com
   ```
4. Recreate the `server` container so it picks up the new `.env` (`docker compose up -d --force-recreate
   server` — env vars are read at container start, not hot-reloaded).

Outlook/other providers work the same way if they support app passwords for SMTP; the host/port just
differ. We tried Brevo first — as of this writing their signup flow pushes new accounts toward a paid
plan before showing (if it still exists) a free tier, so we went with Gmail instead. Worth re-checking if
you'd rather use a dedicated transactional provider.

Hit something unexpected? Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) first — several non-obvious
issues below are already solved there.
