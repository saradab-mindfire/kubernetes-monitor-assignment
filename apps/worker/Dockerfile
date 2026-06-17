# Build context must be the repo root (pnpm workspace):
#   docker build -f apps/worker/Dockerfile -t monitoring-worker .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter worker build
RUN pnpm --filter worker deploy --prod --legacy /out/worker

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /out/worker/package.json ./package.json
COPY --from=build /out/worker/node_modules ./node_modules
COPY --from=build /repo/dist/worker ./dist

CMD ["node", "dist/index.js"]
