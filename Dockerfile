ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/merchant-dashboard/package.json ./artifacts/merchant-dashboard/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm install --frozen-lockfile --prod=false --offline || pnpm install --frozen-lockfile --prod=false
RUN pnpm --filter @workspace/api-server run build
ENV PORT=8080 BASE_PATH=/ VITE_API_URL=
RUN pnpm --filter @workspace/merchant-dashboard run build

FROM node:${NODE_VERSION} AS runtime
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY --from=build /app/artifacts/merchant-dashboard/dist ./artifacts/merchant-dashboard/dist
COPY --from=build /app/lib ./lib
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 8080
ENV PORT=8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
