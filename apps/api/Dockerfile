# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --prod=false
COPY apps/api apps/api
RUN pnpm --filter @businessos/api build
RUN pnpm --filter @businessos/api deploy --prod --legacy /out
RUN cd /out && /app/apps/api/node_modules/.bin/prisma generate --schema prisma/schema.prisma

# Explicit operations image: migrate/seed only from a private operator environment.
FROM build AS operations
ENV NODE_ENV=production
USER node
CMD ["pnpm", "db:migrate"]

FROM base AS runtime
ENV NODE_ENV=production PORT=4000
COPY --from=build --chown=node:node /out /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
