-- Supabase/PostgreSQL vector store used by the semantic report service.
-- report_id references MySQL REPORTS.report_id logically; PostgreSQL cannot
-- enforce a foreign key across the two databases.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.report_embeddings (
    report_id INTEGER PRIMARY KEY,
    embedding VECTOR(384) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS report_embeddings_vector_idx
    ON public.report_embeddings
    USING hnsw (embedding vector_cosine_ops);
