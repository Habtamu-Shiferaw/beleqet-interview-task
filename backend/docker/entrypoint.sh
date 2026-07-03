#!/bin/sh
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
POSTGRES_USER="${POSTGRES_USER:-beleqet_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-your_password}"
POSTGRES_DB="${POSTGRES_DB:-beleqet_db}"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] Initializing Postgres data directory at $PGDATA"
  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$PGDATA"
  su-exec postgres initdb -D "$PGDATA" --username=postgres --auth=trust --encoding=UTF8 >/dev/null

  su-exec postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses='localhost'" -w start

  su-exec postgres psql -v ON_ERROR_STOP=1 --username postgres <<-EOSQL
CREATE USER ${POSTGRES_USER} WITH SUPERUSER PASSWORD '${POSTGRES_PASSWORD}';
CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};
EOSQL

  su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop
  echo "[entrypoint] Postgres initialized."
else
  echo "[entrypoint] Postgres data directory already present, skipping initdb."
fi

exec "$@"
