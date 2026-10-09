#!/bin/sh
set -e

# Some hosting platforms (Render confirmed) always inject their own $PORT and route ALL public traffic
# there, regardless of what this image declares or EXPOSEs. nginx — not the backend — must be the thing
# actually listening on it, so: capture it now (falling back to 80 when nothing sets it, e.g. a plain
# `docker run` or local testing), then force the backend onto a fixed internal port below, UNCONDITIONALLY
# overriding whatever that same platform-injected $PORT would otherwise make it try to bind to. Without
# this, the backend (which already reads $PORT itself — see backend/src/main.ts) can win the race to bind
# the platform's real public port before nginx gets there, leaving nginx stuck listening on a port nothing
# ever routes to, and the backend silently answering every request directly, frontend included.
NGINX_PORT="${PORT:-80}"
export NGINX_PORT
envsubst '${BACKEND_ORIGIN} ${NGINX_PORT}' < /etc/nginx/http.d/default.conf.template.src > /etc/nginx/http.d/default.conf
rm /etc/nginx/http.d/default.conf.template.src

# Runs migrations, generates TOKEN_ENCRYPTION_KEY if one wasn't provided, then execs node — backgrounded
# here because nginx (not this process) is the container's actual foreground/PID-1-facing process;
# if the backend crashes, nginx keeps serving the static frontend, degraded (API calls fail) rather than
# the whole container dying — acceptable for how this image is used, not for docker-compose's own setup.
cd /app/backend
export PORT=8080
./docker-entrypoint.sh &

exec nginx -g 'daemon off;'
