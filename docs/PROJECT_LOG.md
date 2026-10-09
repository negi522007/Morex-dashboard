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

**Sept 26** — Merged Morayo's `feat/youtube` (Morex frontend + YouTube service + 3-widget weather) into
`feat/morex-backend` and verified the whole stack end to end (API, then the real frontend in a headless
browser: no console errors, no failing requests, all widget kinds rendering). Fixed a signup problem found
in use: an unconfirmed account used to block its email address forever; it is now replaced on retry (2 min
cooldown against mail spam) and purged after 24 h. The mailer now treats a refused recipient as a failure,
adds a plain-text part, and logs what the SMTP server answered. Documented why confirmation links only work
for the machine running the server unless `APP_URL` is public (TROUBLESHOOTING.md).

**Sept 26 (defense checklist)** — Went through the school's defense checklist against the running app.
Fixed: `docker compose up --build` now starts everything (the web app was missing from compose — it is
built and served by nginx, which also forwards the API routes), works with **no `.env`** (safe defaults,
mail to Mailhog, an encryption key generated once into a dedicated volume that is not served publicly),
and waits for the database (a fresh clone used to crash on its first migration). Verified from a copy of the
repo without `.env`. The UI findings for Morayo are listed at the end of FRONTEND.md.

**Sept 26 (later)** — Reported by a user: the world clock rejected "Égypte" and "Bangladesh" ("Unknown city").
Cause: the form only knew city names (IANA zones are named after cities). Fix: the backend now resolves
cities *and countries* in three languages (`city-timezones` + `countries-and-timezones` datasets), serves a
type-ahead `GET /services/worldclock/places` for a dropdown, and the widget accepts plain names. Also added
a **help assistant** (`/helpdesk/*`): a trilingual knowledge base of guides, every service/widget/parameter
and the technical vocabulary, searchable without AI and answered by the AI model from those pages only when
available (never an error: it degrades to the best page). A test fails if a widget or parameter has no help
entry. Free AI model guidance re-checked against the providers' current docs; `AI_REASONING_EFFORT` added for
reasoning models. Specs for every screen not yet built are in FRONTEND.md.

**Sept 26 (evening)** — Feedback from a real user test, acted on: (1) the confirmation link opened a bare
white page and confirmed on click. It now opens a styled "Is this you?" page with *Yes* and *No, it wasn't
me* (which deletes the pending account and closes that address to sign-ups for a day), and a plain GET never
confirms anything (mail scanners open links). The email itself is styled and trilingual. (2) The offline
"mock" AI was refused in production so a demo can never show fake AI text; a real Gemini key is used instead.
(3) Date of birth is collected at sign-up (validated, ≥ 13, optional on the API until the form asks for it)
for a **Well-being widget group** (quote of the day, did you know, horoscope — Morayo's idea was a group of widgets, not a page, so it is three ordinary widgets). (4) **Steam** service added.
(5) A **Microsoft sign-in** restricted to one organisation (tenant-checked against email spoofing) as the
self-service alternative to My Epitech's staff-only client registration — untested against the real
Microsoft until the app is registered. The Epitech/Microsoft/GitHub-style sign-ins now share one accounts
service and one controller factory instead of copies.

**Sept 28** — Two requests after trying the app: generalize the world clock's new suggestion dropdown to
every field, everywhere; and make the widget-creation assistant a real conversation instead of a one-shot
command. Added live/real suggestion endpoints for weather cities (Open-Meteo geocoder), market currencies
and crypto (Frankfurter + CoinGecko), YouTube trending countries (static), curated RSS feeds, and — the most
useful one — `custom_api/inspect`, which fetches the URL the user already typed (through the SSRF guard) and
proposes the actual JSON paths found in it, so the `path`/`titleField`/`subtitleField` fields go from "guess
a path" to "pick from what's really there." A new `WidgetParam.dependsOn` lets a field's suggestions depend
on another field's current value (used by `custom_api`'s path-dependent fields). `POST /assistant/widgets`
now takes an optional `history` and can answer with only a clarifying `reply` and no `suggestions` — a
question, not a guess — when the request is too vague. Also found and fixed a real bug of my own: a Steam
unit test used `make(undefined)`, which (JS default-parameter quirk) silently fell back to the default key
instead of testing the "no key" path, and `custom_api`'s `path` was wrongly required, breaking APIs whose
answer is a bare list or value at the root.

**Sept 29** — Two real, hands-on bug reports, both fixed and verified live against the running app: a
GitHub widget config saved as a full pasted URL (`https://github.com/owner/repo`) instead of `owner/repo`
was silently 404ing forever, and a `market_data` widget saved with a free-typed crypto name ("Ether")
instead of its CoinGecko id ("ethereum") did the same — both now self-heal on the next refresh (the GitHub
one normalizes a pasted URL; the market one resolves the name via the existing suggestion search and
retries once), no need to delete and recreate the widget. Also: **Steam was built, then removed** — Valve
only issues a Web API key to an account that has spent at least $5 real money once (a "Limited Account"
policy, unrelated to owning free games), which isn't testable here, so it was pulled rather than shipped
unverified (see API.md → *Deliberately not built*). YouTube confirmed working end to end with a real key.

**Oct 8–9** — Real examiner feedback from a defense dry-run, addressed directly: `PATCH /widgets/:id` had
no server-side shape check on `position` (garbage accepted with a `200`) and let a wrong-typed
`shared`/`aiEnabled`/`title` reach Prisma directly, surfacing as a raw `500` instead of our own clean `400`
— found live with devtools, matching exactly how it was caught at the defense, fixed and re-verified the
same way. The admin console got its frontend (the backend existed, untested from a browser until now, and
got a real end-to-end pass: register, ban, delete, through the actual UI). Every doc but `README.md` moved
into `docs/`, with a small script added to confirm every relative link in the repo still resolves — not
just the ones touched by hand. `ARCHITECTURE.md` now states outright where the database lives (the
`db_data` Docker volume, the `psql` command to open a real session on it), not just the schema file's path.

Then, two follow-up requests once the admin page was actually tried: (1) ban and delete now require a
written reason and email the affected user — with a reply-to-contest inbox, deliberately short of a full
appeal-ticket workflow (judged disproportionate for this project's size, see `FRONTEND.md`'s "Admin
console"). (2) **"Sign in with Google"** added, mirroring the GitHub OAuth integration almost exactly —
`OAuthAccount.provider` was already a free-form string, so no schema change was needed. (3) Microsoft
sign-in opened from epitech.eu-only to any Microsoft account (any organisation, and personal accounts) —
removing the tenant restriction also removed the one thing that made trusting the `email` claim safe (any
Entra ID tenant admin can set it to whatever they want — the "nOAuth" class of vulnerability), so a
brand-new Microsoft sign-in can still create a fresh account, but can no longer silently attach to an
*existing* one just because the email matches; that's a clear error now, not a takeover path.

Also deployed publicly for the first time (optional — the brief only requires `docker-compose up` on a
fresh clone, already covered): Neon for Postgres, Brevo for real email (Render's free tier blocks outbound
SMTP on 587/465/25 — found live, fixed by switching providers to one with an alternate port, not by
touching the app's SMTP code at all), and a combined single-container image (`deploy/`, not used by
`docker-compose.yml`) once splitting frontend and backend across two hostnames turned out to break every
OAuth login (the provider's callback always lands on one fixed domain, so a CSRF-state or session cookie
set while the browser *looked* like it was on the other domain never comes back). Two real platform
surprises along the way, both fixed and documented in `deploy/`'s own comments: a `PORT` env var in the
image collided with Render's own public-port auto-detection, and Render turned out to always inject its
own `$PORT` regardless — nginx now listens on whatever that is instead of a hardcoded port, with the
backend forced onto a fixed internal one so the two can never end up racing for the same port again.

**Oct 9 (admin, Services tab)** — Removed the hint line above the planets ("Click a planet · the bigger,
the more widgets · red ring = errors"), on request: it cluttered the orbit view. Removed in both the
React screen (`AdminServices.tsx`, its `orbitHint` text in FR/EN/ES in `shared.tsx`, the now-unused
`.adm-system-hint` style in `admin.css`) and the mockup `apparences-admin-services.html`, so the two
stay identical.

**Oct 9 (admin console redesign, Morayo)** — The first admin page was a plain table; it was redesigned
page by page, each design chosen on HTML mockups first (`frontend/public/apparences-admin-*.html`, the
choices are listed in `FRONTEND.md` → *Admin console*) and then rebuilt in React with the same look:
- **Four pages instead of one**, each with its own URL (`/admin`, `/admin/accounts`, `/admin/services`,
  `/admin/moderation`), a collapsible sidebar with the Morex logo, FR / EN / ES, no page titles.
- **Overview:** the dashboard's greeting card with the slogan, a health score out of 100, to-do cards, six
  numbers, the account breakdown as a ringed planet, a 14-day growth curve, "le voyage des nouveaux"
  (signed up → confirmed → first widget → linked account) with the Morex logo travelling along, and the
  latest sign-ups as a timeline with real avatars.
- **Accounts:** list + sheet — avatar, birth date with age and sign, last login and last activity, linked
  accounts as provider logos, open sessions by browser, and a **miniature of the user's dashboard** (same
  order, sizes and service colours, failing widgets marked). Search unrolls from a lens.
- **Services:** a rotating solar system (most used closest to the sun, hover freezes it, click opens the
  service sheet with its most used widgets and last error) and a read-only ranking.
- **Moderation:** accounts to confirm with an hourglass ring of the hours left before deletion, suspended
  accounts with their reason.

Backend additions for it (all admin-only, tested — 28 admin tests, full suite 525): `GET /admin/service-stats`,
`GET /admin/users/:id/sessions`, `GET /admin/users/:id/widgets` (never the widgets' `config` or data),
and new fields on `GET /admin/users` (avatar, birth date, last login / last seen, linked account names).
To know "when was this person last here, from what", sessions now record their browser and last activity
(`touchSession`, written at most every 5 minutes, never blocking a request — migration
`20261009120000_add_session_activity`), and GitHub / Google links keep the account's public name.
Two small things found while building it: a smooth animation needs a GPU `transform` set straight on the
DOM, not a React re-render each frame (the orbit was jerky); and a chart scaled like an image becomes huge
on a wide screen, so the admin charts are drawn at the card's measured width instead.

Earlier the same week (Morayo, already committed): the refresh countdown ring on every card, the
"stale data" ribbon and empty-state card, a 45 s cap per widget refresh (one hung fetch used to freeze
every widget), "Delete my account" (password, or email for password-less accounts) and "Download my data"
as one JSON file — now documented in `API.md` and `ARCHITECTURE.md` → *Scheduler*.

**Oct 9 (Terms / Privacy pages, Morayo)** — `/terms` and `/privacy` were plain white text on black, outside
the Morex look, and their text had fallen behind the app (they still said admins only see name / email /
status, and nothing about the new session tracking). Redesigned as **a letter on lined paper** (chosen among
four mockups, `frontend/public/apparences-legal.html`), one shared `LegalPage` with tabs between the two
documents, and the text rewritten in FR / EN / ES in `lib/legal.ts`: moderation with an emailed reason,
what an admin can and cannot see, sign-in tracking (no IP, no location), and the right to download or
delete your data. The line pointing readers to the technical `PRIVACY.md` on the repository was removed from the
page on request (the page stands on its own; `docs/PRIVACY.md` remains the full version for the team).

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
| Microsoft sign-in opened to any account, not just epitech.eu | Oct 9 | Requested directly; the email claim can no longer be trusted enough to auto-link to an existing account across arbitrary tenants (nOAuth), so that specific path was closed instead of left trusting it |
| Public deploy's SMTP: Brevo, not Gmail directly (local dev keeps Gmail) | Oct 9 | Render's free tier blocks outbound ports 25/465/587 — found live; Brevo's SMTP also answers on 2525, which isn't blocked |
| Admin sees metadata, never content: widget list without `config`/data, session list without ids | Oct 9 | Enough to help and moderate; `config` can hold keys and private URLs, a session id is a login cookie |
| Activity written at most every 5 min, fire-and-forget from `SessionGuard` | Oct 9 | "Last seen" doesn't need second precision; never slow down or fail a real request for it |
| Admin API under `/admin/users` and `/admin/service-stats`, pages under `/admin/*` | Oct 9 | Only API prefixes are proxied, so reloading a page never lands on the backend |
| Each refresh capped at 45 s, 8 in parallel, tick 5 s | Oct 9 | One unreachable service used to freeze every widget; countdowns on cards need a short tick |

## What's left

See the root [README.md](../README.md#todo) TODO for the live checklist. As of this writing, the open
items are:
- Weather, Steam, and Maps/Cinema services (Morayo)
- Per-widget custom rendering (currently a generic key/value dump)
- Frontend: the repo-picker dropdown, a profile/settings page, GitHub-linked-status indicator, and the
  Terms-of-Service/Privacy-Policy checkbox + in-app docs page (all specced in `FRONTEND.md` for Morayo —
  `PRIVACY.md` now exists as real content for that last one, not a placeholder)
- Responsive/mobile layout — not yet tested
