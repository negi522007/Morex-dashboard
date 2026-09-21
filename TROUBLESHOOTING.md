# Troubleshooting

Real issues hit and fixed while building this project, kept here so nobody has to debug them twice.
Organized roughly in the order you'd hit them (setup → auth → services).

## `docker-compose: command not found`

Your machine has the modern Docker Compose **plugin** (`docker compose`, two words), not the old
standalone binary (`docker-compose`, one word, with a hyphen). Use `docker compose up` /
`docker compose build` — same behavior, different command name. This repo's `docker-compose.yml` works
with either; only the CLI invocation differs.

## `docker compose up` fails: `address already in use` on port 5432

Something else on your machine (often a system-wide Postgres install) is already listening on 5432.
This repo's `db` service publishes Postgres on the host as **`55432`**, not `5432`, specifically to avoid
this — if you still hit it, check `docker-compose.yml` hasn't been edited back to `5432:5432`, or that
nothing else is bound to `55432` either (`ss -ltnp | grep 55432`).

## Server container crashes on start: `@prisma/client did not initialize yet`

The Prisma client is generated from `prisma/schema.prisma` at build time, not installed as pre-built
code — if the Dockerfile runs `npm ci` before the schema is even copied into the image (or never runs
`prisma generate` at all), the container starts with no client to import. Fixed by generating
(`npx prisma generate`) after `COPY . .` in the build stage, and by copying the generated
`node_modules/.prisma` folder into the slim production stage (`COPY --from=build /app/node_modules/.prisma
./node_modules/.prisma`) — the production stage's own `npm ci --omit=dev` reinstalls `@prisma/client`
itself but has no way to regenerate its contents (the `prisma` CLI that does that is a separate package).

## Server container crashes: `Error loading shared library libssl.so.1.1`

Prisma's query engine binary, as originally generated, targets OpenSSL 1.1 — but recent
`node:20-alpine` images ship OpenSSL 3.x only, with no 1.1 compatibility library. Two-part fix:
`generator client { binaryTargets = ["native", "linux-musl-openssl-3.0.x"] }` in `schema.prisma` (so
Prisma actually generates/downloads an engine built for the OpenSSL version Alpine has), plus
`RUN apk add --no-cache openssl` in **both** Dockerfile stages (the libraries themselves still need to be
present at runtime, generating the right engine variant isn't enough on its own).

## Migrations never applied — tables don't exist at runtime

`docker-entrypoint.sh` runs `npx prisma migrate deploy` before starting the server, every container
start — this is intentional (keeps a fresh `docker compose up` always schema-correct) but means
**migration files must be committed** (`backend/prisma/migrations/`). If you change `schema.prisma`,
generate a migration and commit it: `npx prisma migrate dev --name <description>`, run against a reachable
Postgres (e.g. `docker compose up -d db` then `DATABASE_URL=postgresql://dashboard:dashboard@localhost:55432/dashboard npx prisma migrate dev --name ...`
from `backend/`, since the container's own `db` hostname only resolves inside the Docker network).

## `cookie-parser` import throws `is not a function` at runtime (but `tsc` compiled it fine)

`import cookieParser from 'cookie-parser'` needs `esModuleInterop: true` in `tsconfig.json`.
`allowSyntheticDefaultImports` (which this repo also has) only silences the *type-checking* error for a
default import from a CommonJS module — it does not change what JavaScript actually gets emitted, so
without `esModuleInterop` too, the compiled code ends up calling `.default` on a module whose real export
*is* the function itself, i.e. `undefined`. Both flags are needed together; check `tsconfig.json` if a
similar default-import-from-a-CJS-package error shows up for some other package.

## Login "works" (200, `Set-Cookie` in the response) but the cookie never shows up in the browser

Check whether the `Set-Cookie` header has `Secure`. The Docker image sets `NODE_ENV=production`, and if
that (rather than an explicit flag) gates the cookie's `Secure` attribute, every cookie gets `Secure` in
the built image — which a real browser silently refuses to store over plain HTTP, and this app has no
TLS termination in `docker-compose.yml`. Fixed by gating `Secure` on `COOKIE_SECURE` (an explicit env
var, default `false`) instead of `NODE_ENV`. `curl` will happily show you the `Set-Cookie` header
regardless — a browser is a stricter test than `curl` here, worth checking both.

## Registering an account "succeeds" (`201`) but no confirmation email shows up in my real inbox

By default every email goes to **Mailhog** (`http://localhost:8025`), not a real mailbox — that's
intentional (see `docker-compose.yml`'s comment on the `mailhog` service), so `docker-compose up` works
without any real SMTP account. If you registered with your own real address expecting it in your actual
inbox, check Mailhog first — the email is there. To get real delivery instead, configure a real SMTP
provider in `.env` (see [CONTRIBUTING.md](./CONTRIBUTING.md#sending-real-confirmation-emails-not-just-to-mailhog))
— and recreate the `server` container afterward, since env vars are only read at container start.

## Registering "succeeds" (`201`) but the confirmation email fails with `550 Invalid syntax in MAIL command`

Almost always a stale `backend/.env` (or root `.env`) — if `.env.example` gained new/changed variables
(`SMTP_FROM`, `APP_URL`, ...) after your `.env` was first created with `cp`, your `.env` still has the
old (often empty) values. `SMTP_FROM=` (empty) produces a malformed `MAIL FROM:` command that the SMTP
server (Mailhog or a real one) rejects. Re-copy `.env.example` → `.env` (merging in any secrets you'd
already set) whenever `.env.example` changes.

## GitHub OAuth: "Be careful! The `redirect_uri` is not associated with this application"

GitHub checks the `redirect_uri` byte-for-byte against the OAuth App's **Authorization callback URL**
setting. A trailing slash, `https` vs `http`, or any typo on either side breaks it. Both must read
exactly `http://localhost:8080/auth/github/callback` — check the GitHub App's settings page and
`GITHUB_OAUTH_CALLBACK_URL` in `.env` side by side.

## Linked GitHub account, but a GitHub widget still 404s

The OAuth scope requested at linking time (`read:user user:email`) deliberately does **not** include
`repo` or `public_repo` (least privilege — these widgets only read). That means **private repos 404
regardless of a linked account**; only public repos work. Verified directly: the team's own private
Epitech repo 404s, `nestjs/nest` (public) works. This is expected behavior, not a bug — see
`github.provider.ts`'s comment on the tradeoff if it needs revisiting later.

## GitHub OAuth linking fails with `409 "This GitHub account is already linked to another user"`

Not a bug — the whole point of the unique constraint on `(provider, providerAccountId)` (see
`ARCHITECTURE.md`'s OAuth section). Your real GitHub identity can only be linked to **one** platform
user at a time. Hit this while testing with multiple throwaway accounts? Find who currently holds it and
either log in as that account instead, or free it up:
```sql
SELECT o."providerAccountId", u.email FROM "OAuthAccount" o
  JOIN "User" u ON u.id = o."userId" WHERE o.provider = 'github';

DELETE FROM "OAuthAccount" WHERE provider = 'github' AND "providerAccountId" = '<id from above>';
```
(via `docker compose exec db psql -U dashboard -d dashboard -c "..."` from the repo root.)

## Chrome DevTools console: "Don't paste code you don't understand" warning blocks a pasted `fetch(...)`

Chrome's paste-protection. Type `allow pasting` into the console and press Enter once, then paste again.

## Testing the scheduler by hand: a freshly-seeded row shows no `cachedData` after a few seconds

The tick runs every 15s on a fixed interval from server start, not from when a row was inserted — insert
right after a tick just fired and you're waiting nearly a full 15s for the next one. Not a bug; just wait
longer (poll `lastRefreshedAt IS NOT NULL` in a loop) before concluding something's broken.
