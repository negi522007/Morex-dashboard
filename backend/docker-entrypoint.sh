#!/bin/sh
set -e

# No TOKEN_ENCRYPTION_KEY in the environment (e.g. a fresh clone with no .env):
# generate one once and keep it in the secrets volume, so what is encrypted with
# it (OAuth tokens, secret widget params, journal) survives restarts. Set your
# own in .env for anything beyond local use; never change it once data exists.
if [ -z "$TOKEN_ENCRYPTION_KEY" ]; then
  KEY_FILE=/app/secrets/token_key
  mkdir -p /app/secrets
  if [ ! -s "$KEY_FILE" ]; then
    openssl rand -hex 32 > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
    echo "[entrypoint] TOKEN_ENCRYPTION_KEY not set: generated one in the secrets volume"
  fi
  TOKEN_ENCRYPTION_KEY="$(cat "$KEY_FILE")"
  export TOKEN_ENCRYPTION_KEY
fi

# Belt and braces next to the compose healthcheck: retry while the database wakes up.
i=0
until npx prisma migrate deploy; do
  i=$((i+1))
  if [ "$i" -ge 15 ]; then echo "[entrypoint] database still unreachable, giving up"; exit 1; fi
  echo "[entrypoint] migration failed (database not ready?), retrying in 3s ($i/15)"
  sleep 3
done
exec node dist/main.js
