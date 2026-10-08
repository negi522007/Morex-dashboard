#!/bin/sh
set -e

# Alpine's nginx package has no built-in envsubst-on-templates entrypoint (that's specific to the
# official nginx Docker image, which deploy/Dockerfile deliberately isn't based on) — do the same
# substitution ourselves, by hand, once, at container start.
envsubst '${BACKEND_ORIGIN}' < /etc/nginx/http.d/default.conf.template.src > /etc/nginx/http.d/default.conf
rm /etc/nginx/http.d/default.conf.template.src

# Runs migrations, generates TOKEN_ENCRYPTION_KEY if one wasn't provided, then execs node — backgrounded
# here because nginx (not this process) is the container's actual foreground/PID-1-facing process;
# if the backend crashes, nginx keeps serving the static frontend, degraded (API calls fail) rather than
# the whole container dying — acceptable for how this image is used, not for docker-compose's own setup.
cd /app/backend
./docker-entrypoint.sh &

exec nginx -g 'daemon off;'
