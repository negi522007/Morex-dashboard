# Combined single-container image: nginx (serving the built frontend and reverse-proxying API routes)
# and the compiled NestJS backend, both running in the SAME container on ONE public hostname.
#
# NOT used by docker-compose.yml, which keeps backend and frontend as two separate, already-tested
# containers — that setup is what the project is graded on and stays untouched. This image exists only
# for hosting on a platform that runs one container per service (e.g. Render's free tier): splitting
# frontend and backend across two different public hostnames breaks every OAuth login flow, because the
# provider's callback always lands on one fixed, pre-registered domain — the CSRF-state and session
# cookies set while the browser *appeared* to be on the other domain never come back. One shared domain
# sidesteps the problem entirely instead of needing CORS + SameSite=None cookies across two origins.
#
# Build from the repo root: docker build -f deploy/Dockerfile -t <image> .

FROM node:20-alpine AS backend-build
RUN apk add --no-cache openssl
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache openssl nginx gettext

WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=backend-build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=backend-build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/prisma ./prisma
COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Same template the standalone frontend image uses, untouched — only BACKEND_ORIGIN differs (here,
# the backend process next door on localhost, never an external URL).
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf.template /etc/nginx/http.d/default.conf.template.src

COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# nginx is what's actually reachable from outside, on whatever port the hosting platform decides (see
# deploy/start.sh — some platforms, Render confirmed, always inject their own $PORT and route public
# traffic there regardless of what this image EXPOSEs). The backend is forced onto a fixed internal port
# (8080, by start.sh, unconditionally) specifically so it can never end up competing for that same public
# port — nginx must be the only thing answering it. BACKEND_ORIGIN here matches that fixed backend port.
ENV BACKEND_ORIGIN=http://127.0.0.1:8080
EXPOSE 80
CMD ["/app/start.sh"]
