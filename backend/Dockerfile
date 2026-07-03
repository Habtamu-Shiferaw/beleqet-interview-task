# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 4000

# NOTE: the project has no versioned prisma/migrations yet (schema is synced via
# `db push`). `--accept-data-loss` is intentionally omitted so a risky schema
# change fails the container start instead of silently dropping data; once
# migrations exist, switch this to `npx prisma migrate deploy`.
CMD sh -c "npx prisma db push && npm run start:prod"