# Beleqet — Hiring & Freelance Platform

Beleqet is an AI-assisted hiring and freelance marketplace for the Ethiopian market. The
repo is split into two independent projects:

| Path | Stack | Purpose |
|---|---|---|
| [`backend/`](backend/README.md) | NestJS, PostgreSQL, Prisma, Redis/BullMQ, OpenAI | REST API — auth, jobs, applications, AI screening, freelance gigs, escrow, wallet |
| [`beleqet-jobs-nextjs/`](beleqet-jobs-nextjs/README.md) | Next.js 14 (App Router), TypeScript, Tailwind | Public-facing job board UI (currently backed by mock data in `lib/mockData.ts`) |

See each project's own README for full setup, environment variables, module maps, and API
reference. This file only covers running both together.

## Quick start (full stack)

```bash
# 1. Backend: start Postgres + Redis, then the API
cd backend
docker-compose up -d
cp .env.example .env      # fill in JWT secrets, OPENAI_API_KEY, etc.
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev         # http://localhost:4000/api/v1 (Swagger at /api/docs)

# 2. Frontend (separate terminal)
cd beleqet-jobs-nextjs
npm install
npm run dev                # http://localhost:3000
```

The frontend does not yet call the backend API — it renders from static mock data. See
["Connecting real data"](beleqet-jobs-nextjs/README.md#connecting-real-data) in the
frontend README for how to wire it up.

## Repo layout

```
backend/               NestJS API (see backend/README.md)
beleqet-jobs-nextjs/    Next.js job board UI (see beleqet-jobs-nextjs/README.md)
Beleqet_System_Architecture.docx   High-level architecture doc
```
