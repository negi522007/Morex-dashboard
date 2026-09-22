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
disagree).

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
  "lastName": "Lovelace"
}
```
`firstName`/`lastName` are optional — omit them entirely rather than send empty strings. There is no
endpoint to set them later yet (no profile-edit route exists), so right now registration is the only
chance to set them.

| Status | When |
|---|---|
| `201` | Created. Body: `{ id, email, firstName, lastName }` (`firstName`/`lastName` are `null` if not provided). A confirmation email was sent — the account can't log in yet. |
| `400` | Invalid email format, or password under 8 characters. |
| `409` | An account with this email already exists. |
| `503` | The confirmation email failed to send — the account was **not** created (safe to retry). |

### `GET /auth/confirm?token=...`

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
| `200` | Body: `{ id, email, firstName, lastName }`. `Set-Cookie: dashboard_session=...` attached. |
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
| `200` | `{ id, email, firstName, lastName }` for the current user (`firstName`/`lastName` are `null` if never set). |
| `401` | No valid session. |

### `GET /auth/github`

🔒 Session required. **Not a login route** — this links a GitHub account to the *already* authenticated
user, for widget authorization. Navigate the browser here directly (don't `fetch` it); it 302-redirects
to GitHub's consent screen.

| Status | When |
|---|---|
| `302` | Redirect to GitHub. |
| `400` | GitHub OAuth isn't configured on the server (missing env vars). |
| `401` | No valid session. |

### `GET /auth/github/callback`

🔒 Session required. GitHub redirects here after consent — the frontend never calls this directly.
Plain-text response.

| Status | When |
|---|---|
| `200` | `"GitHub account linked. You can close this tab."` |
| `400` | Missing/mismatched CSRF state, or GitHub rejected the code. |
| `409` | This GitHub account is already linked to a *different* platform user. |

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
  "position": { "x": 0, "y": 0, "w": 4, "h": 2 },
  "lastRefreshedAt": "2026-09-17T22:32:49.701Z",
  "cachedData": [{ "title": "...", "link": "...", "publishedAt": "..." }],
  "userId": "uuid",
  "createdAt": "...",
  "updatedAt": "..."
}
```
`lastRefreshedAt`/`cachedData` are `null` until the scheduler's first tick after creation (up to 15s).

### `POST /widgets`

Body:
```json
{
  "serviceName": "rss",
  "widgetName": "article_list",
  "config": { "link": "https://hnrss.org/frontpage", "number": 3 },
  "refreshRateSeconds": 60,
  "position": { "x": 0, "y": 0, "w": 4, "h": 2 }
}
```
`config` keys/types must match that widget's `params` from `/about.json` (`required` params must be
present; `integer`-typed params must actually be integers). `refreshRateSeconds` must be `>= 10`.
`position` is optional (defaults to `{}`) — shape it however the grid layout library needs.

| Status | When |
|---|---|
| `201` | Created — same shape as a `GET /widgets` row. |
| `400` | Unknown service/widget, invalid config, refresh rate too low, or (for a service with `requiresAuth: true`, e.g. `github`) no linked account/subscription yet — link it first via `GET /auth/github`. |

### `PATCH /widgets/:id`

Reconfigure *and* move share this one endpoint — send whichever of `config`, `refreshRateSeconds`,
`position` changed (at least one required). Omitted fields are left untouched.

```json
{ "config": { "link": "https://hnrss.org/frontpage", "number": 1 }, "position": { "x": 2, "y": 3, "w": 4, "h": 2 } }
```

| Status | When |
|---|---|
| `200` | Updated instance, same shape as `GET /widgets`. |
| `400` | Invalid config for this widget's `params`, refresh rate too low, or an empty body. |
| `404` | No such instance for this user. |

### `DELETE /widgets/:id`

| Status | When |
|---|---|
| `204` | Deleted. |
| `404` | No such instance for this user. |

---

## Services

Service-specific endpoints that aren't widget data itself — currently just GitHub's repo picker.

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

## Not built yet

- Weather, Steam, and Maps/Cinema services — once they exist, `/about.json` and the `serviceName` values
  usable in `/widgets` will include them automatically, no doc update needed on this side.
