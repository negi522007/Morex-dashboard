# Privacy

Plain-language note on what this app collects and why — not a legal document. This is a student
project (Epitech), not a company; we're not going to dress this up as formal Terms of Service. If you
want the technical detail behind any of this (hashing, encryption), see
[ARCHITECTURE.md's Security section](./ARCHITECTURE.md#security).

## What we collect

- **Email** — to identify your account and send you the confirmation link when you sign up.
- **First and last name** — required at sign-up, shown in the dashboard so it feels like *your*
  dashboard rather than an anonymous session.
- **Password** — never stored as-is. It's run through a one-way hash (scrypt) before it ever touches the
  database; nobody, including an admin, can look up or recover your actual password.
- **A GitHub access token, if you link your GitHub account (or sign up/sign in with GitHub)** — used only
  to call GitHub's API on your behalf for the GitHub widgets you configure (e.g. showing your repos'
  recent commits), and, if you use "Sign in with GitHub", to read your GitHub username, display name, and
  verified email once, to create or match your account. It's encrypted at rest (AES-256-GCM) and only
  decrypted in memory, right when it's needed. We never see or store your GitHub *password* — GitHub's
  OAuth flow means we never have it in the first place.
- **If you sign up via "Sign in with GitHub"** instead of email/password, your account has no password at
  all until you set one — there's currently no way to add one after the fact (see "what we don't do
  yet" below).
- **What your widgets fetch** — e.g. if you add an RSS widget, the last few articles from the feed you
  configured are cached so the dashboard can show them without hitting that feed on every page load.
- **Your journal entries, if you write any** — encrypted at rest (AES-256-GCM, same as GitHub tokens
  above), decrypted only when *you* read them back. Not even an admin can read your journal text — the
  admin view only ever shows account metadata (see "Who can see what" below), never journal content.
- **Your bio, and your avatar** — a bio is just free text you write about yourself, shown on your own
  dashboard. An avatar is either a generated character built from options you pick (no image is ever
  stored for that — it's assembled by a third-party service, DiceBear, from a URL each time it's shown)
  or, if you upload a real photo instead, that file is stored on the server (not sent to DiceBear or
  anyone else) and served back only to render your own avatar.

## What we don't do

- We don't sell or share your data with anyone.
- We don't post, comment, or take any action on GitHub (or anywhere else) on your behalf beyond reading
  what a widget you explicitly added is configured to read.
- We don't track you across other sites, and there's no analytics/advertising pixel anywhere in this app.

## Your control over it

- You can change your name or password any time (in account settings).
- You can disconnect your GitHub account yourself (`DELETE /auth/github`, no frontend button yet — see
  `FRONTEND.md`), or from GitHub's own side (Settings → Applications). Either way, any GitHub widgets you
  have will simply fail on their next refresh until you reconnect. If GitHub is your *only* way to log in
  (you signed up via "Sign in with GitHub" and never set a password), unlinking is blocked — there's
  currently no way to add a password after the fact, so removing GitHub would lock you out entirely.
- There is currently no self-service "delete my account" button — if you want your account and its data
  removed, ask an admin. (Worth knowing plainly: this is a gap we haven't closed yet, not a hidden
  policy.)
- An admin can suspend (ban) or delete an account. Banning immediately ends every active session for
  that account, everywhere it was logged in — see `ARCHITECTURE.md` if you're curious why that's
  instant rather than "eventually."

## Who can see what

Regular users only ever see their own data. Admins can see every account's email, name, confirmation
status, and how many widgets/linked accounts/sessions it has — never anyone's password or the raw
content of their encrypted tokens.
