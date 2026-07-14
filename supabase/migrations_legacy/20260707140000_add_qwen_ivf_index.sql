-- =============================================================================
-- S1 fix — add the missing ANN index for the qwen3 embedding subset.
-- =============================================================================
-- public.embeddings holds two models (armenian-text-embeddings-2-large + qwen3).
-- Only the armenian subset had a partial IVFFlat index (embeddings_ivf_metric_idx),
-- so every ECHR/qwen vector query (search_legal_corpus_dual.qwen_ann) did a full
-- sort over ~163k vectors. This adds the matching partial IVFFlat index so the
-- qwen dense route uses an ANN index instead of a sequential sort.
--
-- Verified live (avmgtsonawtzebvazgcr): plan changed from Sort(163,627) to
-- "Index Scan using embeddings_ivf_qwen_idx" (cost ~46,305 -> ~4,343).
--
-- NOTE: on the live DB this was built with CREATE INDEX CONCURRENTLY (no write
-- lock). This migration uses a plain CREATE INDEX IF NOT EXISTS so it is
-- transaction-safe for `supabase db push`; it is a no-op where the index exists.
-- Consider HNSW (embeddings_hnsw_qwen_idx) as a later recall/latency upgrade.
-- =============================================================================

CREATE INDEX IF NOT EXISTS embeddings_ivf_qwen_idx
  ON public.embeddings USING ivfflat (vector vector_cosine_ops) WITH (lists = 400)
  WHERE model = 'qwen3-embedding-0.6b' AND status = 'success';

COMMENT ON INDEX public.embeddings_ivf_qwen_idx IS
  'Dual index: qwen3-embedding-0.6b (ECHR) only. Partial (status=success). Do not mix Metric-AI vectors here.';
