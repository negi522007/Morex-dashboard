# API Reference

Endpoint reference for whoever is building the frontend against this backend. For *why* things are
built this way, see [ARCHITECTURE.md](./ARCHITECTURE.md); this file is just the contract.

Base URL in development: `http://localhost:8080`. There's also a live, interactive version of this same
reference — generated straight from the code, so it can't drift from it — at
**`http://localhost:8080/docs`** once the server is running (raw OpenAPI JSON at `/docs-json`).

## Authentication model

Session-based, not JWT (see [ARCHITECTURE.md](./ARCHITECTURE.md#why-sessions-instead-of-jwt)). After a
successful login, the server sets an `httpOnly` cookie (`dashboard_session` by default) — the browser
sends it back automatically on every same-origin request. **There is no token to read or attach
yourself.** Just make sure requests are sent with credentials included, e.g. with `fetch`:

```js
fetch('http://localhost:8080/widgets', { credentials: 'include' });
```

Routes marked **🔒 Session required** return `401 Unauthorized` with no valid session cookie.

Errors are always JSON: `{ "statusCode": number, "error": string, "message": string }`.

---

## `GET /about.json`

Public. The brief's mandatory endpoint — also doubles as the live source of truth for which
services/widgets exist and what parameters they take (more reliable than this doc if the two ever
disagree). A param may carry `"secret": true` (see *Secret parameters* under Widgets).

**Response `200`:**
```json
{
  "client": { "host": "172.20.0.1" },
  "server": {
    "current_time": 1789682708,
    "services": [
      {
        "name": "rss",
        "widgets": [
          {
            "name": "article_list",
            "description": "Display the last items from a given feed",
            "params": [
              { "name": "link", "type": "string", "required": true },
              { "name": "number", "type": "integer" }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## Auth

### `POST /auth/register`

Public. Body:
```json
{
  "email": "user@example.com",
  "password": "at least 8 characters",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "birthDate": "2001-02-28"
}
```
`birthDate` (`YYYY-MM-DD`, at least 13 years old) is used only to compute the zodiac sign, which pre-selects the horoscope widget (see *Well-being*). It is accepted and validated now, and made mandatory by setting `REQUIRE_BIRTH_DATE=true` on the server once the register form asks for it (`400` otherwise). Accounts created with GitHub / My Epitech / Microsoft have none until the user adds it via `PATCH /auth/me { birthDate }` (`null` removes it).

`firstName`/`lastName` are **required**. Editable later via `PATCH /auth/me` (see below).

**Unconfirmed signups don't lock the address.** If the same email registers again while its previous signup was never confirmed (older than 2 minutes), the old unconfirmed account is replaced by the new one and a fresh confirmation mail is sent (the old link stops working). Unconfirmed accounts are also deleted automatically 24 h after creation, when their link expires. Confirmed accounts are never replaced. So the register form can simply be retried; no special "resend" flow is needed.

| Status | When |
|---|---|
| `201` | Created. Body: `{ id, email, firstName, lastName, isAdmin }`. A confirmation email was sent — the account can't log in yet. |
| `400` | Invalid email format, password under 8 characters, or missing `firstName`/`lastName`. |
| `409` | A confirmed account with this email already exists — **or** an unconfirmed signup for it was created less than 2 minutes ago (message: "A confirmation email was just sent…"; show it as-is, and suggest checking spam). |
| `503` | The confirmation email failed to send — the account was **not** created (safe to retry). |

### The confirmation email — "Is this you?"

The email contains a link to `GET /auth/confirm?token=…`. It **never confirms by itself** (mail scanners and link previews open links automatically): it shows a styled page that asks *"Is this you?"* with two buttons.

| Route | What |
|---|---|
| `GET /auth/confirm?token=&lang=` | The page (HTML, in the browser's language or `?lang=fr|en|es`): question, **"Yes, it's me"** and **"No, it wasn't me"**. Invalid/expired links show a "this link doesn't work" page with a way forward. If `CONFIRM_PAGE_URL` is set, it redirects there instead (`?token=` appended) so a React page can replace it. |
| `GET /auth/confirm/preview?token=` | JSON `{ email: "a***@gmail.com", firstName, expiresAt }` for a custom page. Changes nothing. `401` if invalid/used/expired. |
| `POST /auth/confirm` `{ token }` | **Yes, it's me.** → `{ status: "confirmed" }`; the user can log in. `401` if invalid. |
| `POST /auth/confirm/reject` `{ token }` | **No, it wasn't me.** Deletes the pending account and blocks that address from password sign-ups for 24 h (so nobody can keep mailing it). Never touches an already-confirmed account. → `{ status: "removed" }`. |

After *yes* the page offers "Sign in" (→ `FRONTEND_URL/login`) and first-step tips; after *no* it explains nothing was activated, that no more sign-up mail will be sent for 24 h, and what to do next. `POST /auth/register` answers `409` with a clear message while an address is blocked.

### `GET /auth/confirm?token=...` (legacy note)

Public — the link emailed on register. Plain-text response, not JSON.

| Status | When |
|---|---|
| `200` | `"Email confirmed. You can now log in."` |
| `400` | Missing `token` query param. |
| `401` | Token unknown or expired (24h TTL). |

### `POST /auth/login`

Public. Body:
```json
{ "email": "user@example.com", "password": "..." }
```

| Status | When |
|---|---|
| `200` | Body: `{ id, email, firstName, lastName, isAdmin }`. `Set-Cookie: dashboard_session=...` attached. |
| `400` | Invalid email format, or missing password. |
| `401` | Unknown email or wrong password (same message for both — doesn't reveal which). |
| `403` | Correct credentials, but the email hasn't been confirmed yet. |

### `POST /auth/logout`

🔒 Session required. No body.

| Status | When |
|---|---|
| `204` | Session deleted server-side and the cookie cleared. Logs out immediately, everywhere that cookie was used. |

### `GET /auth/me`

🔒 Session required. Useful to check "am I logged in" on app load.

| Status | When |
|---|---|
| `200` | `{ id, email, firstName, lastName, isAdmin, createdAt, bio, theme, language, widgetSkin, avatarConfig, avatarPhotoUrl, githubLinked, epitech }` for the current user. `epitech` is `null` or `{ login, name, email, campus, promotion, cursus, groups[] }` (see *My Epitech* below); `microsoft` is `null` or `{ name, email, tenant }`; `birthDate` is `"YYYY-MM-DD"` or `null` and `zodiac` (`aries`…`pisces`) is derived from it. |
| `401` | No valid session. |

`githubLinked` is the only way the frontend can know whether GitHub is connected — there's no other
endpoint that exposes it. `theme`/`language`/`widgetSkin` default to `"galaxy"`/`"en"`/`"glass"` and
persist across devices (not `localStorage`). `avatarConfig` is the DiceBear "avataaars" option object (or
`null`); `avatarPhotoUrl` is a real uploaded photo's path (or `null`) and takes priority over
`avatarConfig` when both are set — see `POST /auth/me/avatar` below.

### `PATCH /auth/me`

🔒 Session required. Update your own profile — **not** email (would need its own re-verification flow,
out of scope for now). Body: any of
```json
{
  "firstName": "Ada", "lastName": "Lovelace",
  "currentPassword": "the-old-one", "newPassword": "at-least-8-chars",
  "bio": "Building things.", "theme": "desertMoon", "language": "en", "widgetSkin": "glass",
  "avatarConfig": { "skinColor": "ae5d29", "top": "curly" }
}
```
`currentPassword` is required (and checked) only when `newPassword` is present. A successful password
change deletes every **other** session for this user — the one making the request stays logged in, every
other one is logged out immediately.

| Status | When |
|---|---|
| `200` | Updated user, same shape as `GET /auth/me`. |
| `400` | Empty body, a blank name, `bio` over 280 chars, an invalid `theme`/`language`/`widgetSkin`, or `newPassword` under 8 characters. |
| `401` | `currentPassword` is wrong (only checked when changing password), or no valid session. |

Valid values: `theme` — `galaxy, aurora, moon, dolphins, forest, mystic, ocean, beach, desertNight,
desertMoon`. `language` — `fr, en, es`. `widgetSkin` — `glass, neon, pastel, minimal, holo`.

### `POST /auth/me/avatar`

🔒 Session required. Multipart upload (`multipart/form-data`, field name `photo`) — a real photo,
replacing any DiceBear-generated avatar in the UI (the old uploaded file, if any, is deleted). jpeg/png/
webp/gif only, 5MB max, stored on a Docker volume and served back from `avatarPhotoUrl`.

| Status | When |
|---|---|
| `200` | Updated user, `avatarPhotoUrl` now set. |
| `400` | No file, wrong type, or over 5MB. |

### `DELETE /auth/me/avatar`

🔒 Session required. Removes the uploaded photo (and its file) — falls back to the DiceBear-generated
avatar from `avatarConfig`.

| Status | When |
|---|---|
| `200` | Updated user, `avatarPhotoUrl` now `null`. |

### `GET /auth/github`

🔒 Session required. **Not a login route** — this links a GitHub account to the *already* authenticated
user, for widget authorization. Navigate the browser here directly (don't `fetch` it); it 302-redirects
to GitHub's consent screen.

| Status | When |
|---|---|
| `302` | Redirect to GitHub. |
| `400` | GitHub OAuth isn't configured on the server (missing env vars). |
| `401` | No valid session. |

### `DELETE /auth/github`

🔒 Session required. Unlinks the current user's GitHub account.

| Status | When |
|---|---|
| `204` | Unlinked. |
| `401` | No valid session. |
| `404` | No linked GitHub account for this user. |
| `409` | This account has no password — unlinking would remove the only way to log in. Set a password first (not currently possible via the API — see `PROJECT_LOG.md`'s "what's left"). |

### `GET /auth/github/login`

No session required — this is **"Sign in with GitHub"**, a real alternative to `POST /auth/login`, not
just account linking. Navigate the browser here directly (a normal `<a href>`, not `fetch`); it
302-redirects to GitHub's consent screen with a separate CSRF state cookie from the link flow above (both
share the one registered OAuth callback URL, told apart by which cookie GitHub's redirect carries back).

| Status | When |
|---|---|
| `302` | Redirect to GitHub. |
| `400` | GitHub OAuth isn't configured on the server (missing env vars). |

What happens once GitHub redirects back, in order:
1. **This GitHub account is already linked to a platform user** → log them in.
2. **It isn't, but GitHub reports a verified email matching an existing local account** → link this
   GitHub account to that one and log them in (never a second `User` for the same person).
3. **Neither** → register a brand-new account from the GitHub profile (`name` split into
   first/last, falling back to the GitHub username if there's no display name) with `emailVerified: true`
   right away — GitHub already verified that address, so a second confirmation email would be pure
   friction. No password is set; this account can only ever sign in via GitHub unless its owner sets one
   through a password-reset flow (not built — see `PROJECT_LOG.md`'s "what's left").

If GitHub reports **no verified email at all**, or the resulting account is banned, the flow fails — see
the callback below.

### `GET /auth/github/callback`

GitHub redirects here after consent for **both** flows above — the frontend never calls this directly.
Behavior depends on which flow started it:

| Status | When |
|---|---|
| `200` | Link flow: `"GitHub account linked. You can close this tab."` (plain text). |
| `302` | Login flow, success: redirects to `<FRONTEND_URL>/dashboard`, session cookie set. |
| `302` | Login flow, failure (no verified email, or the account is banned): redirects to `<FRONTEND_URL>/login?error=<message>`. |
| `400` | Missing/mismatched CSRF state (either flow), or GitHub rejected the code. |
| `409` | Link flow only: this GitHub account is already linked to a *different* platform user. |

---

## Widgets

All routes 🔒 Session required, and scoped to the caller — you only ever see/modify your own instances.
A widget instance belonging to someone else behaves exactly like one that doesn't exist (`404`), on
purpose: existence isn't leaked.

### `GET /widgets`

List the current user's widget instances (for rendering the dashboard).

**Response `200`:** array of:
```json
{
  "id": "uuid",
  "serviceName": "rss",
  "widgetName": "article_list",
  "config": { "link": "https://hnrss.org/frontpage", "number": 3 },
  "refreshRateSeconds": 60,
  "position": { "order": 0, "cols": 1, "rows": 2 },
  "title": null,
  "decoration": null,
  "lastRefreshedAt": "2026-09-17T22:32:49.701Z",
  "cachedData": [{ "title": "...", "link": "...", "publishedAt": "...", "image": null, "summary": null, "feedTitle": "..." }],
  "aiEnabled": false,
  "insight": null,
  "insightAt": null,
  "shared": false,
  "userId": "uuid",
  "createdAt": "...",
  "updatedAt": "..."
}
```

`cachedData` is whatever that widget's `fetchData` returns. The shapes the frontend draws:

| Widget | `cachedData` |
|---|---|
| `rss/article_list` | `[{ title, link, publishedAt, image, summary, feedTitle }]` — the first three are unchanged; `image` (absolute http(s) URL from the feed's media/enclosure/first `<img>`, else `null`), `summary` (feed's own blurb, tags stripped, ≤280 chars, else `null`) and `feedTitle` are **additive** and never break old code. |
| `market_data/exchange_rate` | `{ base, quote, rate, asOf, days, history: [{ timestamp, price }], min, max, changePct }` — fiat pairs (both codes 3 letters and known to the ECB, e.g. `eur`/`usd`) use ECB reference rates via Frankfurter; anything else is a CoinGecko id (`bitcoin`/`usd`). If only the crypto history request fails, `history` is `[]` and the rate still comes back. `days` is an optional param (default 7, max 90). |
| `market_data/price_history` | `[{ timestamp, price }]` |
| `github/*` | commits `[{ sha, message, author, date }]`, issues `[{ number, title, author, createdAt }]`, stats `{ stars, forks, openIssues, description }`, **new** `daily_changes` (params `repo`, `hours` default 24, max 168) `{ repo, hours, since, commitCount, authors: [{ name, count }], commits: [{ sha, message, author, date }] }` (needs a linked GitHub account like the other GitHub widgets) |
| **new** `calendar/upcoming_events` | `{ events: [{ title, start, end, allDay, location }], generatedAt }` — params `url` (**secret**: a Google Calendar "secret address in iCal format", or any `.ics`/`webcal://` link), `days` (default 14, max 60), `number` (default 8, max 30). `start`/`end` are ISO instants; all-day events start at 00:00 UTC of their date. Recurring events are expanded. **Private widget: cannot be shared.** |
| **new** `epitech/planning` | same shape as the calendar — param `calendarToken` (**secret**, the token from My Epitech → calendar link), `days`, `number`. **Private, cannot be shared.** |
| **new** `epitech/profile` | `{ login, name, email, campus, promotion, cursus, groups[] }` — no params; needs a linked My Epitech account (`needsAccount`, see below). Private. |
| `steam/profile` | `{ steamId, name, avatar, url, status: "offline"\|"online"\|"busy"\|"away"\|"snooze"\|"looking_to_trade"\|"looking_to_play", currentGame, level, memberSince, country, isPublic }` — param `steamId` (SteamID64, profile link or custom name). Server needs `STEAM_API_KEY`; the player's profile must be public. Level drives history/alerts. |
| `steam/recent_games` | `[{ appId, name, minutesLast2Weeks, minutesTotal, icon, header, url }]` — params `steamId`, `number` (default 5, max 10). Needs "Game details" public; otherwise the log explains how to fix it. |
| `steam/library_stats` | `{ steamId, gameCount, playedCount, neverPlayedCount, totalMinutes, totalHours, topGames: [game] }` — param `steamId`. `totalHours` drives history/alerts. |
| **new** `custom_api/json_value` | `{ label, unit, value, fetchedAt }` — params `url` (**secret**), `path` (e.g. `data.items[0].price`), `label`, `unit`. Public JSON APIs only (no auth headers are ever sent). Numeric values feed history and alerts. |
| **new** `custom_api/json_list` | `{ items: [{ title, subtitle }], fetchedAt }` — params `url` (**secret**), `path` (to an array), `titleField`, `subtitleField`, `number`. |
| `weather/current_weather` | `{ city, country, unit, temperature, feelsLike, humidity, windKmh, condition, isDay, high, low }` — params `city` (required), `unit` (`celsius` default \| `fahrenheit`). Open-Meteo, no key. |
| `weather/daily_forecast` | `{ city, country, unit, now: { temperature, condition }, days: [{ date, condition, min, max, rainChance }] }` — params `city`, `days` (default 5, max 16), `unit`. `days` are the days *after* today. |
| `weather/hourly_forecast` | `{ city, country, unit, hours: [{ time, temperature, condition, rainChance }] }` — params `city`, `hours` (default 12, max 48), `unit`. `time` is local to the city. |
| `youtube/channel_stats` | `{ title, handle, avatar, subscribers, views, videos, url }` — param `channel` (`@handle`, channel id `UC…` or channel URL). `subscribers` is `null` when the owner hides it. |
| `youtube/latest_videos` | `[video]` — params `channel`, `number` (default 5, max 25) |
| `youtube/trending` | `[video]` — params `country` (2 letters, e.g. `FR`), `number` |
| `youtube/video_stats` | `video` — param `video` (id or any youtube.com / youtu.be link) |

`condition` (weather) is one of `clear`, `partly_cloudy`, `cloudy`, `fog`, `drizzle`, `rain`, `snow`, `thunderstorm` — map each to an icon + translated label; the old raw `weatherCode` is gone. A `video` is `{ id, title, channel, thumbnail, publishedAt, views, likes, comments, url }` (counts are numbers, `null` if hidden). **YouTube needs `YOUTUBE_API_KEY` on the server** (`.env`); without it the widgets can be created but stay empty (`cachedData: null`, reason in the server log). The daily YouTube quota is shared by all users, so keep refresh rates reasonable (≥ 5 min).

> **Breaking change since the first weather version:** `weather/forecast` no longer exists (creating it returns `400 Unknown widget`). Widgets already stored under that name simply stop refreshing; delete and recreate them as `current_weather` / `daily_forecast`.
| `worldclock/world_clock` | `{ home, cities: [...] }` — `homeTimezone` and comma-separated `cities` params, IANA names |
`lastRefreshedAt`/`cachedData` are `null` until the scheduler's first tick after creation (up to 15s).

#### Secret parameters (`secret: true` in `/about.json`)

Some params are credentials in disguise (a private calendar URL, an API key inside a URL, a My Epitech
calendar token). `/about.json` marks them `"secret": true` on the param. Rules:

- Render them as a **password field**.
- They are **encrypted at rest** and **never returned**: every read (`GET`/`POST`/`PATCH /widgets`) shows
  `"********"` in `config` instead of the value.
- On `PATCH`, **omit the param or send `"********"` back to keep the stored value**; send a new string to
  replace it. Sending the whole `config` you got from `GET` therefore just works.
- Widgets marked non-shareable (calendar, Epitech) are refused by the public share link.

#### AI insight (opt-in per widget)

`aiEnabled` (default `false`) is set per widget with `POST`/`PATCH /widgets`. When it is on and the server
has AI configured (`GET /ai/status` → `available`), each refresh may fill `insight` (and `insightAt`);
otherwise `insight` stays `null` and **`cachedData` is unchanged** — always render `cachedData` as
before and treat `insight` as an optional bonus. Turning `aiEnabled` off clears `insight`. All text is in
the user's `language`. Shapes (`insight.kind`):

| `kind` | Widgets | Fields |
|---|---|---|
| `rss_digest` | `rss/article_list` | `items: [{ link, image, summary, whyItMatters, topics[], readingMinutes, language }]` — match to `cachedData` rows by `link`; `image` = the article's `og:image` (or feed image); `summary` is a short recap translated into the user's language. |
| `summary` | any widget without a specific one | `{ headline, detail, tone: "good"\|"neutral"\|"warning" }` |
| `weather_advice` | `weather/current_weather`, `weather/daily_forecast` | `{ advice, outfit }` |
| `standup` | `github/daily_changes` | `{ summary, highlights[] }` (empty when no commits) |

Images are hot-linked from the article's site (your browser loads them); use `referrerpolicy="no-referrer"`
and an `onError` fallback.


### `POST /widgets`

Body:
```json
{
  "serviceName": "rss",
  "widgetName": "article_list",
  "config": { "link": "https://hnrss.org/frontpage", "number": 3 },
  "refreshRateSeconds": 60,
  "position": { "x": 0, "y": 0, "w": 4, "h": 2 },
  "title": "My feed",
  "decoration": "flowers",
  "aiEnabled": true,
  "shared": false
}
```
`config` keys/types must match that widget's `params` from `/about.json` (`required` params must be
present; `integer`-typed params must actually be integers). `refreshRateSeconds` must be `>= 10`.
`position` is optional (defaults to `{}`) and is opaque JSON to the server — store whatever the frontend's
layout needs (e.g. an order plus columns/rows spanned). `title`
(a display-name override) and `decoration` (a purely cosmetic sticker key — see `FRONTEND.md`'s `deco.ts`
for the set) are both optional, as are `aiEnabled` (default `false`) and `shared` (default `false`; include this widget on the public share link — see *Sharing*).

| Status | When |
|---|---|
| `201` | Created — same shape as a `GET /widgets` row. |
| `400` | Unknown service/widget, invalid config, refresh rate too low, or (for a service with `requiresAuth: true`, e.g. `github`) no linked account/subscription yet — link it first via `GET /auth/github` (or `GET /auth/epitech` for `epitech/profile`), or `shared: true` on a private widget. A missing secret param is a plain "Missing required parameter" `400`. |

### `PATCH /widgets/:id`

Reconfigure *and* move share this one endpoint — send whichever of `config`, `refreshRateSeconds`,
`position`, `title`, `decoration`, `aiEnabled`, `shared` changed (at least one required). Omitted fields are left untouched. Changing `config` makes the widget refresh on the next scheduler tick (≤ 15 s) instead of waiting for its full refresh rate — poll `GET /widgets` shortly after.

```json
{ "config": { "link": "https://hnrss.org/frontpage", "number": 1 }, "position": { "x": 2, "y": 3, "w": 4, "h": 2 }, "title": "Renamed", "decoration": "none" }
```
Same optional `title`/`decoration` as `POST /widgets` above — sending `decoration: null` (or `"none"`)
clears it.

| Status | When |
|---|---|
| `200` | Updated instance, same shape as `GET /widgets`. |
| `400` | Invalid config for this widget's `params`, refresh rate too low, or an empty body. |
| `404` | No such instance for this user. |

### `GET /widgets/:id/history?days=7&points=200`

The widget's main number over time, sampled by the server on refresh (at most one sample per 5 min, kept
90 days) — so trends work for any widget, not only where the upstream API has history.

```json
{ "widgetId": "uuid", "supported": true, "days": 7, "points": [{ "at": "2026-09-25T10:00:00.000Z", "value": 1.17 }] }
```
`supported: false` (and `points: []`) when the widget has no numeric value. Numeric widgets:
`exchange_rate` (rate), `price_history` (latest price), `weather/current_weather` and `weather/daily_forecast` (temperature), `youtube/channel_stats` (subscribers), `youtube/video_stats` (views), `github/repo_stats`
(stars), `github/daily_changes` (commit count), `custom_api/json_value` (when numeric). `days` 1–90,
`points` 2–1000 (long series are thinned evenly, last point kept). A brand-new widget has few points.

### `DELETE /widgets/:id`

| Status | When |
|---|---|
| `204` | Deleted. |
| `404` | No such instance for this user. |

---

## My Epitech

"Connect with My Epitech": OpenID Connect against `https://my.epitech.eu`; the student logs in with their
**Microsoft** account on Epitech's side (we never see a password). Code flow + PKCE (S256), `state` +
`nonce`, and the `id_token` signature (RS256, provider keys) is verified before anything is trusted.

**Why Epitech must be involved.** "Sign in with My Epitech" is an OpenID Connect login: Epitech's server only
lets *registered* applications start it, and registering creates the two values our server needs — a
**client id** and a **client secret** (the secret is generated by Epitech and shown once). Until an app is
registered, Epitech's login page refuses it, and the code has nothing to authenticate with. Registering is a
staff-only action (`POST /sso/clients` on My Epitech's API, needs a staff token), so a student account cannot do
it, and nothing in our code can work around it.

**What to send to Epitech staff** (this is exactly what their form/endpoint takes):

| Field | Value |
|---|---|
| `name` | `Dashboard (Epitech PGE3 2026 project)` — any readable name |
| `clientId` | a short slug you choose, e.g. `dashboard-pge3-2026` |
| `redirectUris` | `["http://localhost:8080/auth/epitech/callback"]` — **plus the public URL of your deployment if it has one** (`<APP_URL>/auth/epitech/callback`, must match `EPITECH_OIDC_CALLBACK_URL` exactly) |
| `tokenEndpointAuthMethod` | `client_secret_post` |
| `scopes` | `openid profile email groups` (those are the only ones Epitech offers) |
| `allowedAudiences` | `["student"]` (add `"staff"` if staff should log in too) |

They send back the client id and the secret → put them in `.env` as `EPITECH_OIDC_CLIENT_ID` /
`EPITECH_OIDC_CLIENT_SECRET`, then `docker compose up -d --force-recreate server`. Ask for a
localhost redirect only for development; for the defense demo, check with them whether a localhost redirect
is accepted.

**Setup (someone at Epitech must do this once):** the app has to be declared by Epitech staff as an OIDC
client with callback `http://localhost:8080/auth/epitech/callback` (and your production URL). They give a
client id/secret → `EPITECH_OIDC_CLIENT_ID` / `EPITECH_OIDC_CLIENT_SECRET` in `.env`. Until then the routes
answer `400 "not configured"` and `GET /auth/epitech/status` says `{ "configured": false }` — **hide the
button in that case.**

| Route | What |
|---|---|
| `GET /auth/epitech/status` | Public. `{ configured: boolean }`. |
| `GET /auth/epitech` | 🔒 **Browser navigation** (not `fetch`): links My Epitech to the logged-in account. |
| `GET /auth/epitech/login` | **Browser navigation**: "Sign in with My Epitech". Creates the account on first use (email verified by Epitech), or attaches to the account with the same verified email. |
| `DELETE /auth/epitech` | 🔒 Unlink. `409` if it is the only way to log in to that account (no password, no GitHub). |
| `GET /auth/epitech/callback` | Epitech's redirect target; **never called by the frontend**. |

The callback redirects to `FRONTEND_URL`: login → `/dashboard`; link → `/dashboard?epitech=linked`;
failures → `/login?error=<message>` (login) or `/dashboard?epitech_error=<message>` (link). Handle those
query params like `githubLinked`/`?error=` today. After linking, `GET /auth/me` returns `epitech: { login,
name, email, campus, promotion, cursus, groups[] }`, and the `epitech/profile` widget becomes addable.

**What My Epitech does *not* give us — and why we don't fake it.** The OIDC scopes offered are identity
only (`openid profile email groups`). Credits, XP, streaks, alerts and notifications live behind the
student app's *internal* API, which needs the browser session's own token. The only ways to get them would
be asking students to paste that token (which is their full Epitech access, would sit in our database, and
expires) or scraping — both refused on purpose. What *is* possible and built: the **planning**
(`epitech/planning`, from the student's personal calendar link) and the **identity card**
(`epitech/profile`). To unlock real student data, ask Epitech (pedagogy/IT) for an official API scope for
the client — once it exists, it is one more widget on the same `ServiceProvider` contract.

## AI

Server-side only. The key lives in `.env` (`AI_PROVIDER`, `AI_API_KEY`, …) and never reaches the frontend.
Everything is **optional and opt-in**; without a key the app behaves exactly as before. No paid provider is
required: any OpenAI-compatible endpoint works, including free ones (Google Gemini, Groq, OpenRouter `:free`
models, or a local Ollama) — ready-to-paste settings are in `.env.example`.

### `GET /ai/status`

🔒 `{ available, provider: "anthropic"|"openai"|"mock"|null, dailyCallsPerUser, usedToday, remainingToday }`.
Use `available` to show/hide every AI control. Reasoning models (Gemini 3.x, `gpt-oss`…) spend part of the token budget thinking; set `AI_REASONING_EFFORT=low` for them (`.env.example`). Each user has a daily call cap (`AI_DAILY_CALLS_PER_USER`,
default 60); when it is reached, insights simply stop updating and the raw data keeps working.

### `GET /brief` · `POST /brief/refresh`

🔒 Today's cross-widget briefing, in the user's language, built **only from widgets with `aiEnabled: true`**
(never the journal).

`GET` → `{ available, brief: null | { headline, items: [{ widgetId, text }], tip, generatedAt, language } }`
(cached per day+language; costs nothing). `POST /brief/refresh` generates/regenerates it (`400` when AI is
off, quota is reached, or no widget has AI on with data). Suggested UX: show the card when `brief` exists;
otherwise a "Generate my brief" button calling `POST`.

### `POST /assistant/widgets`

🔒 Natural-language widget creation. Body `{ "prompt": "follow bitcoin and tech news" }` (≤ 500 chars).

```json
{ "available": true, "suggestions": [{
    "serviceName": "market_data", "widgetName": "price_history", "title": "Bitcoin",
    "config": { "asset": "bitcoin", "days": 7 }, "refreshRateSeconds": 300,
    "reason": "Bitcoin price over the last week", "needsAccount": null, "missingSecrets": [] }] }
```
**Nothing is created.** Show the drafts, and when the user confirms, send the draft to the normal
`POST /widgets` (`serviceName`, `widgetName`, `config`, `refreshRateSeconds`, optional `title`) — every draft
was already validated with those exact rules. `needsAccount` = a service name the user must link first;
`missingSecrets` = params (e.g. a calendar URL) the user must type, never guessed by the model.
`{ available: false, suggestions: [] }` when AI is off.

## Microsoft sign-in (school account)

"Sign in with your school Microsoft account" — for Epitech students this is the same Microsoft login they
already use for My Epitech, **and it needs nobody at Epitech**: you register the app yourself, like the
GitHub OAuth App. It gives identity only (name, `@epitech.eu` address); it is not My Epitech's student data.

| Route | What |
|---|---|
| `GET /auth/microsoft/status` | Public. `{ configured }` — hide the button when `false`. |
| `GET /auth/microsoft/login` | **Browser navigation**: sign in / create the account (first use) / attach to the account with the same address. |
| `GET /auth/microsoft` 🔒 | **Browser navigation**: link Microsoft to the logged-in account. |
| `DELETE /auth/microsoft` 🔒 | Unlink (`409` if it is the only way in). |
| `GET /auth/microsoft/callback` | Microsoft's redirect target; the browser lands on `FRONTEND_URL`: `/dashboard`, `/dashboard?microsoft=linked`, or `/login?error=…` / `/dashboard?microsoft_error=…`. |

**Security rule (why it is restricted to one organisation).** In a multi-tenant Microsoft app, the `email`
of an account from *any* organisation is whatever that organisation's admin typed — an attacker could run
their own tenant with an `@epitech.eu` address. So the server only accepts accounts whose signed `tid`
(tenant id) is the tenant that owns `MICROSOFT_ALLOWED_DOMAIN` (default `epitech.eu`, looked up from
Microsoft's public metadata) *and* whose address ends with that domain. PKCE, `state`, `nonce` and the
RS256 signature/issuer/audience of the `id_token` are verified as for My Epitech.

**Register the app (free, ~10 minutes)** at <https://entra.microsoft.com> → *App registrations* → *New registration*:
1. **Name** `Morex Dashboard`. **Redirect URI**: type *Web*, `http://localhost:8080/auth/microsoft/callback` (add your public URL's callback too for a deployment).
2. **Supported account types** — two ways, try the first:
   - **A. Register it with your own `@epitech.eu` account** (sign in to the portal with it). If "users can register applications" is enabled in Epitech's directory (it is by default), the app then lives *inside* Epitech's tenant: choose *"Accounts in this organizational directory only"*. No consent problem at all, since it is Epitech's own directory. If the portal says you lack permission, use B.
   - **B. Register it in your own free directory** (any Microsoft account) with *"Accounts in any organizational directory (Multitenant)"*. Then Epitech's tenant must allow its users to consent to the app; if Epitech restricts user consent, students see *"Need admin approval"* and only Epitech's IT can approve it (they can, by opening the consent URL as admin). Publisher verification is not possible for a personal project.
3. **Certificates & secrets** → *New client secret* → copy the **Value** (shown once).
4. **Overview** → copy **Application (client) ID**.
5. `.env`: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_CALLBACK_URL` (must match the redirect URI exactly), then `docker compose up -d --force-recreate server`.

This flow is tested here against a simulated Microsoft (signatures, tenant and domain checks, account
creation/linking); it has **not** been run against the real Microsoft login, which needs your app
registration — so do the first real sign-in yourself before the defense.

## Well-being (a group of three widgets)

Not a page: a **service group "Well-being"** (`wellbeing` in `/about.json`) with three free widgets you add like any
other — a quote, a fact and a horoscope. No account, no key, no server setup.

| Widget | Params | `cachedData` |
|---|---|---|
| `wellbeing/daily_quote` (Quote of the day / Citation du jour) | none | `{ date, author, text: { en, fr, es } }` — a real, attributed quote (a few are proverbs); one per day |
| `wellbeing/did_you_know` (Did you know? / Le saviez-vous ?) | none | `{ date, topic: "nature"\|"space"\|"science"\|"history"\|"tech"\|"body", text: { en, fr, es } }` — a short, well-established fact; one per day |
| `wellbeing/horoscope` | `sign` (required; has `optionsUrl: "/services/wellbeing/signs"`) | `{ sign, forDate, text: { en, fr, es }, source: "library", disclaimer: { en, fr, es } }` |

- **Language:** the three texts are all in `cachedData`; **show the one for the interface language** (`user.language` / the
  UI switch), so switching language needs no refetch.
- **Refresh rate:** the content changes once a day; suggest ≥ 1 hour (the minimum the API accepts is 10 s).
- **Horoscope:** it is for fun and says so (`disclaimer`, always show it). The base text is built from a fixed set of sentences
  (`source: "library"`, say so with a small label). With **AI analysis** switched on for the widget (`aiEnabled`), `insight`
  becomes `{ kind: "horoscope", sign, forDate, text, source: "ai", language, disclaimer }` — a freshly written text for the
  sign, in the user's language, shared by every user of that sign for the day; only the sign and the date are sent to the
  model, never the birth date. Show `insight.text` (badge "AI") when present, otherwise `cachedData.text[lang]`.
- **Which sign?** `GET /auth/me` → `zodiac` (derived from the birth date given at sign-up or in the profile) is the natural default:
  pre-select it in the add-widget form; a user without a birth date picks any sign from the list.
- `GET /services/wellbeing/signs?lang=fr` 🔒 → `[{ value: "gemini", label: "Gémeaux", glyph: "♊", range: "05-21 → 06-20" }]` for that dropdown.

## Alerts

🔒 "Tell me when this widget's value goes above/below X." Plain arithmetic on the widget's numeric value
(see `GET /widgets/:id/history` for which widgets have one) — no AI involved. Checked on every refresh.
When it fires: an entry in `GET /alerts/events` **and** an email (fr/en/es, via the configured SMTP).

| Route | What |
|---|---|
| `GET /alerts` | `[{ id, widgetId, label, operator: "above"\|"below", threshold, cooldownMinutes, active, lastTriggeredAt, createdAt }]` |
| `POST /alerts` | Body `{ widgetId, operator, threshold, cooldownMinutes?=60 (1–10080), label? }`. `400` if the widget has no numeric value / bad input / more than 50 alerts; `404` if not the caller's widget. |
| `PATCH /alerts/:id` | Any of `operator, threshold, cooldownMinutes, label, active`. `active: true` re-arms it. |
| `DELETE /alerts/:id` | `204`. |
| `GET /alerts/events?limit=30` | `[{ id, at, value, message, alertId, widgetId, label }]`, newest first — the in-app notification list (poll it, e.g. every 30–60 s, and compare with the last seen `at`). |

## Sharing (read-only public dashboard)

Off by default and per-widget opt-in: nothing is public until the owner creates the link **and** ticks
`shared: true` on specific widgets (private widgets — calendar, Epitech — refuse it).

| Route | What |
|---|---|
| `GET /share` 🔒 | `{ enabled, token, path }` |
| `POST /share` 🔒 | Creates the link. Calling it again **rotates** the token (the old URL dies). |
| `DELETE /share` 🔒 | Turns the link off (`204`). |
| `GET /public/dashboard/:token` | **Public, no login.** `{ owner: { firstName }, theme, widgetSkin, widgets: [{ id, serviceName, widgetName, title, decoration, position, cachedData, insight, lastRefreshedAt }] }`. No `config`, no email, no secrets. `404` for an unknown/disabled/malformed token. Sent with `Cache-Control: no-store` and `X-Robots-Tag: noindex`. |

The frontend owns the page URL: build e.g. `${location.origin}/share/${token}` as a route that calls
`/public/dashboard/:token` **without credentials**.

## Server-side fetching and security notes

Every URL a user can type that the *server* fetches (RSS link, calendar URL, custom API URL, article pages
for recaps) goes through an SSRF guard: only `http`/`https`, no credentials in the URL, and any host that
resolves to a private/loopback/link-local/metadata address is refused — checked before connecting **and**
again at connect time (DNS-rebinding safe), on every redirect, with size and time limits. A refused widget
is simply created and never gets data (`cachedData` stays `null`); the reason is in the server log. Local
dev escape hatch: `ALLOW_PRIVATE_FETCH=true`.

---

## Journal

🔒 Session required on every route below. Private per-user entries (`{ date, mood, text }`) — `text` is
encrypted at rest (AES-256-GCM, same utility as OAuth tokens) and only ever decrypted for the owning
user's own requests.

### `GET /journal`

| Status | When |
|---|---|
| `200` | Array of entries (newest `date` first), text decrypted. |

### `POST /journal`

Body: `{ "date": "2026-09-25", "mood": "😊", "text": "Dear journal..." }` — all fields optional (`date`
defaults to now, `mood` to `"😊"`, `text` to `""`).

| Status | When |
|---|---|
| `201` | Created entry. |
| `400` | `date` present but not parseable. |

### `PATCH /journal/:id`

Body: any of `{ "mood": "😴", "text": "Updated text" }` (at least one required).

| Status | When |
|---|---|
| `200` | Updated entry. |
| `400` | Empty body. |
| `404` | No such entry for this user. |

### `DELETE /journal/:id`

| Status | When |
|---|---|
| `204` | Deleted. |
| `404` | No such entry for this user. |

---

## Services

Service-specific endpoints that aren't widget data itself: GitHub's repo picker and the world clock's place search.

**`optionsUrl` in `about.json`:** a param carrying `"optionsUrl"` should be rendered as a dropdown fed by that URL instead of a free-text field. If the param also has `"multiple": true`, it is a multi-select whose picked `value`s are joined with commas. `optionsUrl` endpoints return `[{ value, label, … }]` and may accept an optional `q` (type-ahead) — the GitHub one ignores it.

### `GET /services/github/repos`

🔒 Session required. Backs the "repo" field's dropdown wherever a GitHub widget's `params` include
`"optionsUrl": "/services/github/repos"` (see `about.json`) — fetch this, render a `<select>` from the
`{ value, label }` array instead of a free-text input, and submit `value` as the `repo` config param.

| Status | When |
|---|---|
| `200` | Array of `{ value, label }`, each `value` an `"owner/repo"` string. Up to 100 repos, most recently updated first — no pagination yet. |
| `400` | No GitHub account linked for this user (connect one via `GET /auth/github` first), or GitHub rejected the request. |
| `401` | No valid session. |
| `503` | Server missing `TOKEN_ENCRYPTION_KEY`. |

### `GET /services/worldclock/places?q=&lang=&limit=`

🔒 Session required. Type-ahead for the world clock's `homeTimezone` (single) and `cities` (`multiple`) params:
cities, **countries** and raw time-zone names, in any language, accents optional. `lang` = `en`|`fr`|`es`
(labels), `limit` 1–20 (default 8). With an empty `q` it returns the biggest cities as a starting list.

```json
[ { "value": "Africa/Cairo", "label": "Égypte", "kind": "country", "country": "Égypte", "offset": "UTC+3" },
  { "value": "Africa/Porto-Novo", "label": "Cotonou, Bénin", "kind": "city", "country": "Bénin", "offset": "UTC+1" } ]
```
Submit the picked `value` (an IANA zone). A country maps to its main zone (for several-zone countries the
label shows which city: `États-Unis (New York)`). The widget also **resolves plain names on the server**, so
`cities: "Delhi, Égypte, Bangladesh"` works even without the dropdown, and each card is labelled with what
the user typed; an unknown place fails with `Unknown place "X"` in the server log (the card stays empty).

---

## Help center (help assistant)

Explains the app to non-technical users: how to do things, each service and widget setting ("where do I find
the channel ID?"), and the technical words they may meet (API key, OAuth, iCal, JSON path, quota, IANA time
zone…). Content is in `en`/`fr`/`es`, written once in `backend/src/helpdesk/kb/`, and a test fails if a
service, widget or widget parameter is added without its help entry — so it cannot drift from `/about.json`.

| Route | Auth | What |
|---|---|---|
| `GET /helpdesk/knowledge?lang=fr` | public | Everything: `{ language, entries: [{ id, kind, title, body, related: [{ id, title }] }] }`. `kind` is `guide`, `service`, `widget` or `term`. Ids: `service`, `service/widget` (e.g. `youtube/trending`), `term-…`, `guide-…`. Cached 1 h. Use it for a Help page, tooltips, and to open an entry by id. |
| `GET /helpdesk/search?q=&lang=&limit=5&service=&widget=` | public | Instant keyword search, no AI (works logged out, e.g. on the login page). `service`/`widget` = where the user is, to rank the relevant entries first. Same entry shape, best first. |
| `POST /helpdesk/ask?lang=` | 🔒 | Body `{ question (2–400 chars), history?: [{ role: "user"\|"assistant", content }] (last 6 kept), context?: { service, widget } }`. |

`POST /helpdesk/ask` answers `{ mode, language, answer, sources: [{ id, title, kind }], followUps: string[], related: [{ id, title }] }`:
- `mode: "ai"` — a short answer written by the model **from the documentation only** (it says it doesn't know rather than inventing), in the user's language (or `?lang=`), with up to 3 suggested follow-up questions.
- `mode: "search"` — AI is off, over its daily limit or failed: `answer` is the best documentation entry as is. **Never an error** — always render it the same way; only the `mode` differs (optionally a small "AI" badge when `ai`).
- Nothing matched: `mode: "search"` with a "not found" sentence and `related` = starter topics.
- `400` for an empty/too long question. The AI path counts against the user's daily AI cap (`GET /ai/status`).

The question is sent to the AI provider only when AI is configured (with the few documentation entries it needs); nothing else about the user is.

---

## Admin

🔒 Session required **and** the account must have `isAdmin: true` (see
[ARCHITECTURE.md#admin-user-management](./ARCHITECTURE.md#admin-user-management) for how an account
becomes an admin — there is no API for that). Every route here 403s for a non-admin, same as a missing
session 401s.

### `GET /admin/users`

| Status | When |
|---|---|
| `200` | Array of every user: `{ id, email, firstName, lastName, emailVerified, isAdmin, isBanned, createdAt, widgetCount, linkedAccountsCount, sessionCount }`. Never includes `passwordHash`. |
| `403` | Not an admin. |

### `PATCH /admin/users/:id`

Edit a user's name and/or manually flip `emailVerified` — useful to unblock someone whose confirmation
email never arrived. **Not** password, **not** `isAdmin`/`isBanned` (those have their own dedicated,
guarded endpoints and aren't editable here on purpose). Body: any of
```json
{ "firstName": "Ada", "lastName": "Lovelace", "emailVerified": true }
```

| Status | When |
|---|---|
| `200` | Updated user, same shape as one row from `GET /admin/users` (minus the counts). |
| `400` | Empty body, or a blank name. |
| `404` | User not found. |

### `PATCH /admin/users/:id/ban`

Blocks login and deletes every existing session for that user in the same transaction — effective
immediately, not on next token expiry (there's no token to expire).

| Status | When |
|---|---|
| `204` | Banned. |
| `400` | Target is yourself, or another admin. |
| `404` | User not found. |

### `PATCH /admin/users/:id/unban`

| Status | When |
|---|---|
| `204` | Unbanned — can log in again. |
| `404` | User not found. |

### `DELETE /admin/users/:id`

Permanent — cascades to the user's sessions, widget instances, OAuth links, etc.

| Status | When |
|---|---|
| `204` | Deleted. |
| `400` | Target is yourself, or another admin. |
| `404` | User not found. |

---

## Backing the Morex mockup

What `frontend/public/mockups.html` shows, and where each piece comes from. Everything here exists on the
backend; only the wiring is left on the frontend side.

| Mockup element | Backend |
|---|---|
| Greeting, bio, "member since" | `GET /auth/me` → `firstName`, `bio`, `createdAt` |
| Theme / widget style / language pills (persist across devices) | `PATCH /auth/me` → `theme`, `widgetSkin`, `language` (validated lists, see above) |
| Avatar editor (DiceBear options) and photo upload | `PATCH /auth/me` → `avatarConfig`; `POST` / `DELETE /auth/me/avatar`; the photo is served from `avatarPhotoUrl` (photo wins over `avatarConfig`) |
| Profile: name, password | `PATCH /auth/me` |
| Profile: GitHub link status, unlink | `githubLinked` on `GET /auth/me`; `DELETE /auth/github`; linking is a browser navigation to `GET /auth/github` |
| Journal card and book | `GET/POST /journal`, `PATCH/DELETE /journal/:id` (`{ date, mood, text }`) |
| Add-widget picker | `GET /about.json` (services and widgets, incl. `weather` and `worldclock`) |
| Widget title and sticker | `title`, `decoration` on `POST` / `PATCH /widgets` |
| Widget order and size | `position` (opaque JSON) |
| Exchange-rate graph, min/max, change | `cachedData.history / min / max / changePct` |
| Bitcoin coin card and chart | `market_data/price_history` (a series of `{ timestamp, price }`) |
| Weather card (now + next days, by the hour) | `weather/current_weather`, `weather/daily_forecast`, `weather/hourly_forecast`, param `city` |
| World clock timeline | `worldclock/world_clock`, params `homeTimezone`, `cities` (the shape only needs the zone names — pins can be computed in the browser) |
| Terminal GitHub card | `github/recent_commits` → `[{ sha, message, author, date }]` |

**Dev proxy:** every backend route prefix must be in `frontend/vite.config.ts`'s proxy list. Beyond `/auth`,
`/widgets` and `/about.json`, add: **`/journal`, `/services`, `/uploads`, `/ai`, `/brief`, `/assistant`,
`/alerts`, `/share`, `/public`, `/helpdesk`** — otherwise Vite answers with its own `index.html` (HTTP 200) and the page
gets HTML where it expects JSON (this caused a white page once already). Note `/public/…` here is the
*API*; pick a different name for the frontend's own share page route (e.g. `/s/:token`) so the proxy
doesn't swallow it.

**Uploads:** `apiFetch` forces `Content-Type: application/json`; the avatar upload needs a `FormData` body
sent *without* that header (the browser sets the multipart boundary itself).

**Not built (the mockup marks both "soon"):** account deletion and "download my data".

---

## Adapting the frontend — checklist for Morayo

**Nothing that exists breaks.** Every change to an existing endpoint is an *added optional field*; old code
keeps working unchanged. Do these in order of value:

1. **Proxy** — add the new prefixes listed above to `vite.config.ts`.
2. **Secret params** — in the add/edit-widget form, render params with `secret: true` as password inputs;
   on edit, don't resend an untouched value (or send back `"********"`). Otherwise editing a calendar widget
   would overwrite its URL with the mask.
3. **`GET /widgets` rows** gained `aiEnabled`, `insight`, `insightAt`, `shared`. RSS `cachedData` items
   gained `image`, `summary`, `feedTitle`. Nothing to change; use them when you want the richer cards
   (`insight.items[].image/summary/readingMinutes` for the magazine card, matched by `link`).
4. **AI controls** — call `GET /ai/status` once; only when `available` show an "AI" toggle per widget
   (`PATCH /widgets/:id { aiEnabled }`), the brief card, and the assistant box.
5. **Charts for any numeric widget** — `GET /widgets/:id/history` (see above).
6. **Alerts** — a bell/list from `GET /alerts/events`, a small form calling `POST /alerts`.
7. **Sharing** — a settings toggle (`POST/DELETE /share`), a per-widget "shared" switch (`PATCH shared`), and a
   public route that reads `/public/dashboard/:token` without cookies.
8. **My Epitech** — if `GET /auth/epitech/status` is `{ configured: true }`: a "Sign in with My Epitech"
   link to `/auth/epitech/login` on the login page and a "Connect" button (`/auth/epitech`) in Profile,
   using `epitech` from `GET /auth/me` for the linked/unlinked state (same pattern as GitHub). Handle the
   `?epitech=linked` / `?epitech_error=` / `?error=` redirect params.
9. **New services in the picker** — they appear in `/about.json` automatically: `calendar`, `epitech`,
   `custom_api`, and `github/daily_changes`. For `epitech/profile` show "connect My Epitech first" when
   creation returns `400`.
10. **Avatar upload** still needs a `FormData` body without a JSON `Content-Type`.

## Deliberately not built

- **Google Photos** — Google restricts the Photos Library API to per-app OAuth verification and, since 2025,
  to files the *app itself* uploaded; it needs a Google Cloud project with credentials that can't be tested
  here. Google **Calendar** is covered instead by `calendar/upcoming_events` (secret iCal address — no OAuth,
  no credentials stored).
- **Epitech credits / XP / streaks / notifications** — see *My Epitech* above.

---

## Not built yet

- Maps/Cinema services — once they exist, `/about.json` and the `serviceName` values
  usable in `/widgets` will include them automatically, no doc update needed on this side.
