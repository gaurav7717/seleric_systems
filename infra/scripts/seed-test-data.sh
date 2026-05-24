#!/usr/bin/env bash
set -euo pipefail

echo "Seeding Postgres + ClickHouse test data..."
echo "Postgres: run pnpm db:migrate from repo root when DATABASE_URL is set."
echo "ClickHouse: apply infra/docker/clickhouse/schema.sql to your instance."
