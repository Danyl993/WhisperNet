# Supabase PostgreSQL

The semantic service stores one normalized MiniLM vector per MySQL report in `report_embeddings`. Apply [`schema.sql`](schema.sql) in the Supabase SQL editor. The HNSW index uses cosine distance. `report_id` matches MySQL `REPORTS.report_id` but is not a PostgreSQL foreign key because the tables live in different database systems.

See [the ER diagrams](../../docs/ER-diagrams.md#supabase-postgresql-pgvector).
