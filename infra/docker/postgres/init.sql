-- infra/docker/postgres/init.sql
-- Runs once when the Postgres container first starts.
-- Sets up pgvector extension and performance indexes.

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigram search (for insight title search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Note: The actual table schema is managed by Prisma migrations.
-- This file only sets up extensions that must exist before Prisma runs.

-- Performance note:
-- After the first batch of insights is inserted (>1000 rows),
-- run this manually to create the HNSW index for fast similarity search:
--
-- CREATE INDEX ON "Insight" USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);
--
-- HNSW is faster than IVFFlat for real-time queries but requires more memory.
-- Switch to IVFFlat if memory is constrained:
--
-- CREATE INDEX ON "Insight" USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
