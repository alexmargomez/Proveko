# ==============================================================================
# PROVEKO — Multi-Stage Dockerfile para Cluster de Microservicios en ALpanel
# ==============================================================================
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY libs ./libs
COPY apps ./apps

RUN find apps libs -name "package.json" -exec sed -i 's/"workspace:\*"/"*"/g' {} + && \
    (npm ci --no-audit --no-fund || npm install --no-audit --no-fund)

# Empaqueta el ejecutor multi-rol (api-gateway, core-service, ms-host-runner, frontend)
RUN npx esbuild apps/api-gateway/src/cluster-node-runner.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
  --outfile=dist/cluster-node-runner.mjs

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache postgresql-client

ENV NODE_ENV=production
ENV PROVEKO_MIGRATIONS_DIR=/app/libs/tenant-db-resolver/migrations

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist/cluster-node-runner.mjs ./dist/cluster-node-runner.mjs
COPY --from=builder /app/libs/tenant-db-resolver/migrations ./libs/tenant-db-resolver/migrations

CMD ["node", "dist/cluster-node-runner.mjs"]

