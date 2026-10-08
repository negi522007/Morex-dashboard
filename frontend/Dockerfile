# Build the React app, then serve it with nginx, which also forwards the API
# routes to the backend container (same origin as in dev, so cookies just work).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# Templates here are rendered through envsubst by the base image's own entrypoint before nginx starts
# (see nginx.conf.template's own comment) — this is what lets BACKEND_ORIGIN differ between a
# docker-compose deploy and a split-host one (e.g. Render) with no Dockerfile change.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
