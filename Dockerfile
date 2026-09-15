FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json ./
# Download the packageManager-pinned pnpm during the build, never at startup.
RUN NODE_USE_ENV_PROXY=1  corepack install

FROM base AS deps
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS builder
COPY . .
RUN pnpm build

FROM base AS production-deps
COPY pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 reactrouter
COPY --chown=reactrouter:nodejs --from=production-deps /app/node_modules ./node_modules
COPY --chown=reactrouter:nodejs --from=builder /app/build ./build
COPY --chown=reactrouter:nodejs --from=builder /app/package.json ./package.json
USER reactrouter
EXPOSE 3000
# Start Node directly; production startup does not need pnpm or Corepack.
CMD ["node", "node_modules/@react-router/serve/bin.cjs", "./build/server/index.js"]
