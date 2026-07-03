# ============================================================================
# Next.js frontend — standalone build, deployed as its own Render Web Service.
# NEXT_PUBLIC_API_URL is a build-time value (Next.js inlines NEXT_PUBLIC_*
# vars into the browser bundle at `next build`), so it must be passed as a
# build ARG, not a runtime env var on Render.
#
# Build & push:
#   docker build \
#     --build-arg NEXT_PUBLIC_API_URL=https://<your-backend>.onrender.com/api/v1 \
#     -t ghcr.io/<you>/beleqet-jobs-frontend:latest .
#   docker push ghcr.io/<you>/beleqet-jobs-frontend:latest
# ============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app
EXPOSE 3000

CMD ["node", "server.js"]
