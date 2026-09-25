# Project Log

Team organization, the timeline of what got built and decided, and what's left — kept as one readable
narrative rather than scattered across commit messages.

## Meetings

Two team meetings anchor the timeline below:

- **Meeting 1 — Sept 15**: decided the technology stack, agreed on the contract between frontend and
  backend (the `ServiceProvider`/`WidgetDefinition` shape), and split the tasks between the two of us.
- **Meeting 2 — Sept 20**: tested the merged result of frontend and backend together and noted the
  inconsistencies and gaps that testing surfaced. That's where the ideas for the admin module, the
  optional name field, a design review, and more came from — the entries below from Sept 21 onward are
  that follow-up work.

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

**Sept 15 (Meeting 1)** — Repo initialized. The team's original architecture proposal
(NestJS/Prisma/Postgres + React, Redis/BullMQ for the timer, JWT auth) was reviewed and challenged point
by point: quantity target raised well above the brief's minimum, Redis/BullMQ flagged as disproportionate
for the project's scale, the OAuth "authorization vs authentication" distinction clarified,
email-confirmation requirement initially missing from the plan. `ServiceProvider`/`WidgetDefinition`
contract designed as the join point between backend services and the frontend, and tasks split between
Exauce and Morayo.

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

**Sept 20 (Meeting 2)** — Morayo built the entire frontend in one push: Vite/React/TypeScript/Tailwind v4
scaffold, the dev proxy to the backend, auth pages (register/login), the protected dashboard (session
check, logout), the GitHub-linking card, the widget grid (add/reconfigure/move/resize/delete via
`react-grid-layout`), and `FRONTEND.md`. The team then tested the merged frontend and backend together —
that pass is what surfaced the gaps behind the entries below: no way to manage users, a registration form
that only asked for email/password, and a design worth a second look.

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
(admin: name, a manual `emailVerified` override). `PRIVACY.md` and this log written. Also: **"Sign in
with GitHub"** (`GET /auth/github/login`) — a real second login path, not just account linking. Reuses
the existing GitHub OAuth App/callback, told apart from the linking flow by which CSRF state cookie is
present. Logs in directly if already linked, links onto a matching-verified-email local account without
duplicating it, or auto-registers a brand-new already-verified account otherwise. `LoginPage.tsx` got a
one-off "Continue with GitHub" link to test it end-to-end. 6 new unit tests (119 total).

**Sept 25** — Backend prepared for Morayo's new frontend (the mockup, `frontend/public/mockups.html`), which
she lays out herself. Added: Journal (text encrypted at rest), World clock, a **Weather** service
(Open-Meteo, no key), profile fields (bio, theme, language, widget style, DiceBear avatar config) plus
avatar photo upload, widget `title` / `decoration`, and `exchange_rate` now returns its history (ECB
reference rates for fiat pairs, CoinGecko for crypto) so a graph can be drawn from real data. Every mockup
element and the endpoint behind it is listed in API.md ("Backing the Morex mockup"). A frontend rebuild was
started along the way and then set aside — the frontend stays Morayo's.

**Sept 25 (later)** — Second backend pass, on `feat/morex-backend`. **Security first:** an audit found that
the RSS fetch would follow any URL a user typed (including internal addresses), so every user-supplied URL
now goes through an SSRF-safe fetcher. **Then features:** provider-agnostic AI (Anthropic / OpenAI-compatible
/ offline mock) with per-widget opt-in, per-user daily cap and a shared cache — RSS gets real images and
recaps, any widget can get an insight, plus a daily brief and a natural-language widget assistant that only
*proposes* validated widgets. New services: generic calendar (`.ics`, covers Google Calendar), custom JSON
API, GitHub daily changes/stand-up, My Epitech (planning via the calendar token; identity via OIDC — the
student signs in with Microsoft on Epitech's side). Also threshold alerts (deterministic, in-app + email),
value history, and a read-only share link. Credential-like widget params are encrypted and masked.
**Decided not to build:** Google Photos (restricted API, needs verified Google Cloud credentials) and
Epitech credits/XP (not exposed by the OIDC scopes; the only workaround is users pasting their session
token, refused for security). The frontend was not touched.

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
| Every user-supplied URL fetched through an SSRF guard | Sept 25 | Audit finding: RSS `fetch(link)` could reach internal services |
| AI is server-side, opt-in per widget, provider-agnostic; never sees the journal | Sept 25 | Key must not reach the browser; PRIVACY.md promises privacy; daily cap protects the key |
| Insight stored beside `cachedData`, not inside | Sept 25 | Keeps every existing widget shape stable for the frontend |
| No Epitech JWT pasting / scraping | Sept 25 | It is the student's full access, would live in our DB and expires; ask Epitech for an official scope instead |
| "Sign in with GitHub" as a real login path, not just linking | Sept 23 | Already the intended design (see `schema.prisma`'s `OAuthAccount` comment from Sept 15) — just not built until now |

## What's left

See the root [README.md](./README.md#todo) TODO for the live checklist. As of this writing, the open
items are:
- Weather, Steam, and Maps/Cinema services (Morayo)
- Per-widget custom rendering (currently a generic key/value dump)
- Frontend: the repo-picker dropdown, a profile/settings page, GitHub-linked-status indicator, and the
  Terms-of-Service/Privacy-Policy checkbox + in-app docs page (all specced in `FRONTEND.md` for Morayo —
  `PRIVACY.md` now exists as real content for that last one, not a placeholder)
- Responsive/mobile layout — not yet tested
