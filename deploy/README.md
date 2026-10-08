# Combined deploy image

A single-container build of this project (nginx + the NestJS backend together), for hosting on a
platform that only runs **one** container per service — this repo's own grading setup
(`docker-compose.yml`, two containers) is untouched and stays what's actually evaluated. See
[Dockerfile](./Dockerfile)'s own comment for why a single shared domain is the point: splitting
frontend and backend across two different public hostnames breaks any OAuth login (GitHub, Google,
Microsoft, My Epitech) — the provider's callback always lands on one pre-registered domain, so a
CSRF-state or session cookie set while the browser appeared to be on the *other* domain never comes back.

## Build and push

```bash
docker build -f deploy/Dockerfile -t <registry>/<image>:latest .
docker push <registry>/<image>:latest
```

(Run from the repo root — the Dockerfile's `COPY backend/` / `COPY frontend/` paths depend on it.)

## Deploy (e.g. Render, "Deploy an existing image from a registry")

- **Port**: `80` (nginx; the backend listens on `3000` internally only, never exposed — see the
  Dockerfile's `ENV BACKEND_ORIGIN`/`ENV PORT`).
- **Environment variables**: the same ones `backend/.env.example` documents (`DATABASE_URL`,
  `TOKEN_ENCRYPTION_KEY`, `APP_URL`, `FRONTEND_URL` — both now the *same* URL, since there's only one —
  `SMTP_*`, OAuth client ids/secrets, etc.). Do **not** set `BACKEND_ORIGIN` or `PORT` yourselves — the
  Dockerfile already fixes those for this image specifically.
