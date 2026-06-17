# Build context must be the repo root (pnpm workspace):
#   docker build -f apps/api/Dockerfile -t monitoring-api .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod --legacy /out/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /out/api/package.json ./package.json
COPY --from=build /out/api/node_modules ./node_modules
COPY --from=build /repo/dist/api ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
