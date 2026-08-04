FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/api/package.json services/api/
RUN npm ci -w @frota/shared -w @frota/api --include-workspace-root
COPY packages/shared packages/shared
COPY services/api services/api
RUN npm run build -w @frota/shared
RUN npm run db:generate -w @frota/api
RUN npm run build -w @frota/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/api/package.json services/api/
RUN npm ci -w @frota/shared -w @frota/api --include-workspace-root --omit=dev
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/services/api/dist services/api/dist
COPY --from=builder /app/services/api/node_modules/.prisma services/api/node_modules/.prisma
COPY services/api/prisma services/api/prisma
WORKDIR /app/services/api
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
