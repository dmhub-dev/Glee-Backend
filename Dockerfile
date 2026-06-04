FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.33.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY prisma ./prisma
RUN pnpm prisma generate
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY views ./views
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod \
  && pnpm prisma generate
COPY --from=build /app/dist ./dist
COPY --from=build /app/views ./views
EXPOSE 8003
CMD ["node", "dist/src/main.js"]
