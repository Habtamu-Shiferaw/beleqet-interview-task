#!/bin/sh
set -e

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"

echo "[start-app] Waiting for Postgres to accept connections..."
until pg_isready -h 127.0.0.1 -p 5432 -U "$POSTGRES_USER" >/dev/null 2>&1; do
  sleep 1
done
echo "[start-app] Postgres is ready."

npx prisma db push
exec node dist/main
