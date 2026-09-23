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
`firstName`/`lastName` are **required**. Editable later via `PATCH /auth/me` (see below).

| Status | When |
|---|---|
| `201` | Created. Body: `{ id, email, firstName, lastName, isAdmin }`. A confirmation email was sent — the account can't log in yet. |
| `400` | Invalid email format, password under 8 characters, or missing `firstName`/`lastName`. |
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
| `200` | `{ id, email, firstName, lastName, isAdmin }` for the current user. |
| `401` | No valid session. |

### `PATCH /auth/me`

🔒 Session required. Update your own name and/or change your password — **not** email (would need its
own re-verification flow, out of scope for now). Body: any of
```json
{ "firstName": "Ada", "lastName": "Lovelace", "currentPassword": "the-old-one", "newPassword": "at-least-8-chars" }
```
`currentPassword` is required (and checked) only when `newPassword` is present. A successful password
change deletes every **other** session for this user — the one making the request stays logged in, every
other one is logged out immediately.

| Status | When |
|---|---|
| `200` | Updated user, same shape as `GET /auth/me`. |
| `400` | Empty body, a blank name, or `newPassword` under 8 characters. |
| `401` | `currentPassword` is wrong (only checked when changing password), or no valid session. |

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

## Not built yet

- Weather, Steam, and Maps/Cinema services — once they exist, `/about.json` and the `serviceName` values
  usable in `/widgets` will include them automatically, no doc update needed on this side.
