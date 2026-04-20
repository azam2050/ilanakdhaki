ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
WORKDIR /app

# ---------- deps stage: install with frozen lockfile ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/
RUN pnpm install --frozen-lockfile --prod=false

# ---------- build stage ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Re-link workspace modules after copying full source
RUN pnpm install --frozen-lockfile --prod=false --offline || pnpm install --frozen-lockfile --prod=false
RUN pnpm --filter @workspace/api-server run build

# ---------- runtime stage ----------
FROM node:${NODE_VERSION} AS runtime
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
WORKDIR /app
ENV NODE_ENV=production

# Copy only what we need to run the compiled bundle
COPY --from=build /app/artifacts/api-server/dist ./dist
COPY --from=build /app/artifacts/api-server/package.json ./package.json

EXPOSE 8080
ENV PORT=8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
