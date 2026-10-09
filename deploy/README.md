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

- **Port**: set the service's port to **`80`** explicitly in the dashboard (nginx; the backend keeps its
  own existing default of `8080` internally only, never exposed — see the Dockerfile's `ENV
  BACKEND_ORIGIN`).
- **Do not set a `PORT` environment variable yourself** on the platform's dashboard, even to `80`. Render
  (and similar platforms) auto-routes a Docker service's public traffic straight to whatever `PORT` env
  var it finds — which would bypass nginx and the frontend entirely, sending everything to the backend
  instead. This image deliberately defines no `PORT` so there's nothing for that auto-detection to grab;
  the dashboard's own explicit "Port: 80" field is what controls routing here.
- **Other environment variables**: the same ones `backend/.env.example` documents (`DATABASE_URL`,
  `TOKEN_ENCRYPTION_KEY`, `APP_URL`, `FRONTEND_URL` — both now the *same* URL, since there's only one —
  `SMTP_*`, OAuth client ids/secrets, etc.). Do **not** set `BACKEND_ORIGIN` yourself either — the
  Dockerfile already fixes that for this image specifically.
