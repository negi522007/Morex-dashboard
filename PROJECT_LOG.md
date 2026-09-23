# Project Log

Team organization, the timeline of what got built and decided, and what's left — kept as one readable
narrative rather than scattered across commit messages.

**A note on "dates" here:** these are the dates real work actually landed (derived from git history and
the working sessions behind it), not scheduled meetings with an agenda and minutes. There's no formal
meeting-minutes practice on this team; this is the honest substitute — a log of *when things actually
changed and why*, which is arguably more useful than a record of when people talked about changing them.

## Team organization

Two people, split by phase and then by service rather than a strict frontend/backend line everywhere:

- **Exauce** — backend/infra: `AuthModule` (sessions, email confirmation, GitHub OAuth linking, profile
  editing), `TimerModule` (scheduler), `WidgetsModule`, `AdminModule`, Docker/CI-adjacent plumbing, plus
  the RSS, Market data, and GitHub services end to end (backend fetcher + this doc set).
- **Morayo** — the entire frontend (Vite/React/Tailwind, auth pages, the widget dashboard, drag/resize,
  the GitHub-linking button), plus the Weather, Steam, and Maps/Cinema services once built.

Rationale recorded in [ARCHITECTURE.md](./ARCHITECTURE.md): split by phase (agree the `ServiceProvider`
contract together first) then by service end-to-end, so neither person blocks on the other during the
bulk of the work — a straight frontend/backend split would have left one person doing 6 backend service
integrations *and* all UI, the other doing comparatively little.

## Timeline

**Sept 15** — Repo initialized. The team's original architecture proposal (NestJS/Prisma/Postgres +
React, Redis/BullMQ for the timer, JWT auth) was reviewed and challenged point by point: quantity target
raised well above the brief's minimum, Redis/BullMQ flagged as disproportionate for the project's scale,
the OAuth "authorization vs authentication" distinction clarified, email-confirmation requirement
initially missing from the plan. `ServiceProvider`/`WidgetDefinition` contract designed as the join point
between backend services and the frontend.

**Sept 16** — Auth strategy revisited from first principles: JWT (the original default, never actually
evaluated against this project's constraints) vs server-side sessions. Sessions won — single-container
deployment gets nothing from JWT's statelessness, and the brief's admin/ban requirement needs instant
revocation, which sessions give for free and JWT doesn't. Scheduler design simplified to
`@nestjs/schedule` (no Redis/BullMQ).

**Sept 17** — Backend bootstrap day: NestJS app, Prisma, a working `GET /about.json` (the brief's
mandatory gate), `AuthModule` (register/confirm/login/logout), GitHub OAuth linking, `TimerModule`, and
three services (RSS, Market data via CoinGecko, GitHub) plus `WidgetsModule` (add/reconfigure/move/
delete). Everything tested against the real running app at each step, not just unit-level.

**Sept 18** — Documentation day: unit tests (Jest, business logic only — see `ARCHITECTURE.md#testing`
for the exact scope), `API.md`, `ARCHITECTURE.md` diagrams, `CONTRIBUTING.md`, `TROUBLESHOOTING.md`,
and a generated Swagger UI at `/docs` alongside the hand-written `API.md`.

**Sept 20** — Morayo built the entire frontend in one push: Vite/React/TypeScript/Tailwind v4 scaffold,
the dev proxy to the backend, auth pages (register/login), the protected dashboard (session check,
logout), the GitHub-linking card, the widget grid (add/reconfigure/move/resize/delete via
`react-grid-layout`), and `FRONTEND.md`.

**Sept 21** — Both branches merged into `main`. Real email delivery configured (Brevo's signup pushed
toward a paid plan on first try, so switched to a Gmail SMTP app password instead) — this also surfaced
a real bug: `docker-compose.yml` was forcing `SMTP_HOST`/`SMTP_PORT` back to Mailhog regardless of
`.env`, silently ignoring real credentials. `firstName`/`lastName` added to `User` (backend + a
one-off, explicitly-authorized frontend edit), initially optional.

**Sept 22** — `AdminModule` built (list/ban/unban/delete) — the brief lists it as useful, not mandatory;
built anyway per the team's own standard of covering everything the brief mentions. A real widget
misconfiguration during testing (a GitHub repo entered without its owner prefix) motivated a proper fix:
a generic `WidgetParam.optionsUrl` contract field plus `GET /services/github/repos`, so a repo picker
dropdown becomes possible (the frontend rendering side is specced in `FRONTEND.md` for Morayo, not
built here). Full documentation pass across every doc file.

**Sept 23** — `firstName`/`lastName` flipped from optional to **required** at registration (reversing
the Sept 21 decision, per explicit instruction). Profile editing added both ways: `PATCH /auth/me`
(self: name, password — a password change kills every other session) and `PATCH /admin/users/:id`
(admin: name, a manual `emailVerified` override). `PRIVACY.md` and this log written.

## Key decisions (quick reference)

| Decision | When | Why |
|---|---|---|
| Node.js/NestJS + React | Sept 15 | Decision matrix — ecosystem fit + team experience, see `ARCHITECTURE.md` |
| Sessions, not JWT | Sept 16 | Single-instance deploy gains nothing from statelessness; admin ban needs instant revocation |
| No Redis/BullMQ for the timer | Sept 15–16 | Disproportionate at this scale; `@nestjs/schedule` is enough |
| GitHub OAuth scope stays minimal (`read:user user:email`) | Sept 17 | Least privilege — these widgets only read; private-repo access wasn't worth the broader scope |
| Build `AdminModule` despite "not mandatory" | Sept 22 | Team standard: cover everything the brief mentions, not just what's enforced |
| `firstName`/`lastName` required | Sept 23 | Explicit decision reversal — was optional, now required at signup |
| Real SMTP via Gmail app password, not Brevo | Sept 21 | Brevo's signup pushed toward a paid plan; Gmail needed no third-party account |

## What's left

See the root [README.md](./README.md#todo) TODO for the live checklist. As of this writing, the open
items are:
- Weather, Steam, and Maps/Cinema services (Morayo)
- Per-widget custom rendering (currently a generic key/value dump)
- Frontend: the repo-picker dropdown, a profile/settings page, GitHub-linked-status indicator, and the
  Terms-of-Service/Privacy-Policy checkbox + in-app docs page (all specced in `FRONTEND.md` for Morayo —
  `PRIVACY.md` now exists as real content for that last one, not a placeholder)
- Responsive/mobile layout — not yet tested
