FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN npm install --global pnpm@11.19.0 \
  && pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages
COPY tests ./tests
COPY fixtures ./fixtures
RUN pnpm build \
  && pnpm prune --prod

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
  TARE_PORT=10000
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/fixtures/live ./fixtures/live

USER node
EXPOSE 10000
CMD ["node", "dist/apps/api/src/main.js"]
