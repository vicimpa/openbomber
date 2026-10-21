# Game server image (Fly.io, see fly.toml): the same Node bundle the prod server runs under pm2.
# Build: bun bundles packages/server into dist/ (Colyseus stays external, pinned in its package.json);
# run: plain Node with just those dependencies.
FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/game/package.json packages/game/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN bun install --frozen-lockfile --filter '@ob/server' --filter '@ob/game'
COPY tsconfig.base.json ./
COPY packages/game packages/game
COPY packages/server packages/server
RUN cd packages/server && bun run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/packages/server/dist ./
RUN npm install --omit=dev --no-audit --no-fund
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 BASE_PATH=/socket.io
EXPOSE 8080
CMD ["node", "index.js"]
