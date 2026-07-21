# 01 — PHASE 5 READ-ONLY DATABASE COVERAGE (live, partial)

**Date:** 2026-07-21
**Source:** operator-provided read-only query results against production
Supabase `avmgtsonawtzebvazgcr` (ledger 52; latest applied migration
`20260719000001`; the reranker migration `20260720000001` is NOT applied).
**Access:** read-only — no writes performed. The historical 162209 count was NOT
reused; all figures below are freshly computed by the operator.

## Provided figures

| Metric | Value |
|---|---|
| TOTAL_CHUNKS (public.search_chunks) | 1,489,780 |
| ACTIVE_CHUNKS (norm_status='active') | 779,040 |
| UNKNOWN_CHUNKS (norm_status='unknown') | 669,292 |
| REPEALED_CHUNKS (norm_status='repealed') | 41,448 |
| EMBEDDING_ROWS (public.embeddings) | 1,489,780 |
| DISTINCT_CHUNKS_WITH_EMBEDDING_ROW | 1,489,780 |
| SUCCESSFUL_EMBEDDINGS (status='success') | 1,489,777 |
| NON_SUCCESS_EMBEDDINGS (status <> 'success') | 3 |
| NULL_VECTOR_ROWS (vector IS NULL) | 0 |
| WRONG_DIMENSION_METADATA_ROWS (dimension <> 1024) | 0 |
| DECLARED_VECTOR_TYPE | vector(1024) |

Consistency check: 779,040 + 669,292 + 41,448 = 1,489,780 (matches TOTAL_CHUNKS).
1,489,777 + 3 = 1,489,780 (matches EMBEDDING_ROWS). Internally consistent.

## Derived metrics

| Metric | Value |
|---|---|
| CURRENT_TRUE_TOTAL_CHUNKS | 1,489,780 |
| CURRENT_TRUE_ACTIVE_CHUNKS | 779,040 |
| CURRENT_TRUE_UNKNOWN_CHUNKS | 669,292 |
| CURRENT_TRUE_REPEALED_CHUNKS | 41,448 |
| CURRENT_TRUE_SUCCESSFUL_EMBEDDINGS | 1,489,777 |
| NULL_VECTOR_COUNT | 0 |
| WRONG_DIMENSION_COUNT (metadata `dimension` column) | 0 |
| CURRENT_TRUE_COVERAGE_PERCENT (successful / total embedding rows) | 99.9997985% |
| CURRENT_TRUE_EMBEDDED_ACTIVE_CHUNKS | 779,037 – 779,040 (pending the 3 non-success breakdown) |
| CURRENT_TRUE_MISSING_ACTIVE_EMBEDDINGS | 0 – 3 (pending the 3 non-success breakdown) |

## Verdict

PHASE_5 = PARTIAL_PASS. Core coverage is effectively complete: 1,489,777 / 1,489,780
successful embeddings (99.9998%), 0 null vectors, 0 wrong-dimension-metadata rows,
1:1 chunk-to-embedding-row cardinality. The historical 162209 gap is no longer
the current state.

## Remaining Phase 5 items needed to reach FINAL_SUCCESS_CONDITION

FINAL_SUCCESS_CONDITION requires ACTIVE_MISSING_EMBEDDINGS = 0,
WRONG_DIMENSION_COUNT = 0 (actual vector bytes, not just metadata), and
ZERO_VECTOR_COUNT = 0. The provided data confirms the metadata-level dimension
and null checks but does NOT yet confirm:

1. Whether the 3 non-success embeddings are active (=> exact
   ACTIVE_MISSING_EMBEDDINGS, 0 or 3).
2. Actual per-vector dimension via `vector_dims(vector)` (pgvector can do this in
   SQL; the `dimension` column is metadata only).
3. ZERO_VECTOR_COUNT (a zero-norm / all-zero vector). pgvector SQL cannot
   cheaply compute L2 norm; use a bounded application-side sample or the
   equality-to-zero-literal count below.
4. NaN / non-finite components — pgvector SQL cannot test component-wise; this
   MUST be a bounded application-side sample (documented limitation).
5. EMBEDDINGS_BY_MODEL_VERSION / BY_LANGUAGE / BY_SOURCE_TYPE.
6. EMPTY_ACTIVE_CHUNK_COUNT, DUPLICATE_ACTIVE_CHUNK_ID_COUNT,
   MISSING_MODEL_PROVENANCE_COUNT, MISSING_CITATION_METADATA_COUNT.

## Requested read-only queries (same read-only access; one operator action)

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';

-- 1. The 3 non-success rows + whether they are active
SELECT e.chunk_id, e.status, e.error_message, e.dimension, sc.norm_status
FROM public.embeddings e
LEFT JOIN public.search_chunks sc ON sc.chunk_id = e.chunk_id
WHERE e.status <> 'success';

-- 2. Active chunks missing a successful embedding (exact ACTIVE_MISSING_EMBEDDINGS)
SELECT count(*) AS active_missing_embeddings
FROM public.search_chunks sc
WHERE sc.norm_status = 'active'
  AND NOT EXISTS (SELECT 1 FROM public.embeddings e
                  WHERE e.chunk_id = sc.chunk_id AND e.status = 'success');

-- 3. Actual per-vector dimension mismatch (vector_dims, not metadata)
SELECT count(*) AS wrong_vector_dims
FROM public.embeddings
WHERE status = 'success' AND vector_dims(vector) <> 1024;

-- 4. Zero-vector count (all components 0). Heavy full scan; if too slow, use the
--    bounded app-side sample in item 4b instead.
SELECT count(*) AS zero_vector_rows
FROM public.embeddings
WHERE status = 'success'
  AND vector = ('[' || array_to_string(array_fill(0::float4, array[1024]), ',') || ']')::vector;

-- 5. Breakdowns
SELECT model, count(*) FROM public.embeddings WHERE status='success' GROUP BY model;
SELECT sc.content_domain, count(*)
  FROM public.embeddings e JOIN public.search_chunks sc ON sc.chunk_id = e.chunk_id
  WHERE e.status='success' GROUP BY sc.content_domain;
SELECT sc.language_code, count(*)
  FROM public.embeddings e JOIN public.search_chunks sc ON sc.chunk_id = e.chunk_id
  WHERE e.status='success' GROUP BY sc.language_code;

-- 6. Data-quality counts
SELECT count(*) AS empty_active_chunks
  FROM public.search_chunks WHERE norm_status='active' AND (text IS NULL OR text = '');
SELECT count(*) - count(distinct chunk_id) AS duplicate_active_chunk_ids
  FROM public.search_chunks WHERE norm_status='active';
SELECT count(*) AS missing_model_provenance
  FROM public.embeddings WHERE status='success' AND (model IS NULL OR model = '');
SELECT count(*) AS active_missing_citation_anchor
  FROM public.search_chunks WHERE norm_status='active' AND (citation_anchor IS NULL OR citation_anchor = '');

COMMIT;
```

## 4b. Bounded application-side sample (for zero-norm + NaN/non-finite, since
##     pgvector SQL cannot test component-wise). Pull e.g. 2000 random
##     success vectors and validate in JS/Python:

```sql
SELECT chunk_id, vector FROM public.embeddings
WHERE status = 'success' ORDER BY random() LIMIT 2000;
```
Then in application code: assert each vector length === 1024, every component
`Number.isFinite`, and `sum(x*x) > 1e-12` (non-zero-norm). Report
ZERO_VECTOR_SAMPLE_COUNT and NON_FINITE_SAMPLE_COUNT (expected 0/2000).

## Next access item after Phase 5 completes

PHASE 4 — public Metric embedding endpoint URL + EMBEDDING_API_KEY (and VPS /
Cloudflare hostname) to verify EMBEDDING_LIVE, MODEL_IDENTITY, DIMENSION, latency
and the live retrieval chain (Phases 4 / 7 / 10).