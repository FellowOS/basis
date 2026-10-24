# Single production image: Basis API (uv) + Hono web (SPA + /api proxy).
# Build context: repository root.

FROM node:22-bookworm-slim AS web_assets

WORKDIR /src
COPY tsconfig.base.json ./
COPY web ./web/
WORKDIR /src/web
RUN npm ci && npm run build

FROM node:22-bookworm-slim AS web_runtime

WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --omit=dev
COPY web/server ./server

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
COPY basis ./basis
RUN uv sync --frozen --no-dev

COPY --from=web_runtime /app/web /app/web
COPY --from=web_assets /src/dist/web /app/web/dist/web

COPY docker/production/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV BASIS_HOST=0.0.0.0 \
    BASIS_PORT=8090 \
    BASIS_DATA_DIR=/data \
    NODE_ENV=production \
    WEB_HOST=0.0.0.0 \
    WEB_PORT=8080 \
    WEB_STATIC_DIR=/app/web/dist/web

EXPOSE 8080
VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]
