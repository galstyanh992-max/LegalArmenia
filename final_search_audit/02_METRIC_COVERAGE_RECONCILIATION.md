# LEGALARMENIA - Metric Coverage Reconciliation of the 162209 figure (Phase 2)

Base: ad20a27. Branch: codex/rag-citation-retrieval-closure. Date: 2026-07-20.
PRODUCTION_MODE = READ_ONLY. No re-embedding performed or proposed for execution in this phase.

## 1. Source of the figure

The 162209 figure is the alleged Metric-only coverage gap. It is NOT present as a literal in the
repo (rg over all .md/.sql/.ts/.json/.txt found no match). It originates from live production
catalog queries captured in a prior session and recorded in
AUDIT_REPORTS/FINAL_03_RAG_SEARCH_CLOSURE.md (codex/final-closure-master-loop branch, head 921ed3d).
Per the non-negotiable rule, old reports are not treated as current live truth; the figure is
reconciled structurally below and its live re-verification is marked as requiring READ_ONLY DB access.

## 2. What 162209 means (structural definition)

The corpus is stored in the documents / document_versions / search_chunks / embeddings schema
(baseline 20260712). embeddings is 1:1 with search_chunks by chunk_id. The active vector model is
armenian-text-embeddings-2-large (dim 1024); legacy qwen3-embedding-0.6b rows also exist.

Definition: 162209 = count of search_chunks rows that have NO successful embedding row whose
model = armenian-text-embeddings-2-large. Equivalently, chunks the Metric-only vector (ANN) lane
cannot reach. These chunks remain reachable by the BM25/FTS lane (which does not use embeddings).

Prior live-capture figures (FINAL_03, for arithmetic context only - NOT re-asserted as current PASS):
  - documents = 218299; current document_versions = 218299
  - search_chunks = 1489780; embeddings rows = 1489780 (1:1)
  - embeddings status=success = 1489777; not-success = 3; null vector = 0
  - chunks missing ANY successful embedding = 3 (0.0002%)
  - Metric-model (armenian-text-embeddings-2-large) success embeddings = 1327574
  - chunks missing a Metric-model embedding = 162209 (~10.9%)
Cross-check: 1489780 - 1327574 = 162206; the +3 delta vs 162209 corresponds to the 3 not-success
embedding rows, consistent with the definition above (missing a SUCCESSFUL metric embedding).

## 3. Required decomposition (per Phase 2 spec) and how each is resolved here

The spec requires separating the 162209 rows into classes A-F. Without live READ_ONLY DB access
(no credentials in this environment - only feature-flag secrets are present), the exact per-class
counts cannot be re-derived from live data. The classification schema and the queries needed to
produce each count are specified below as an executable reconciliation harness; running them
requires only READ_ONLY SELECT on production (avmgtsonawtzebvazgcr).

### Classification

A. REEMBED_REQUIRED - chunk has no successful embedding of ANY model and is search-eligible
   (active/current, has fts_vector). True count is expected to be tiny (~3, the not-success rows)
   IF those chunks are eligible; otherwise 0.
B. DOCUMENT_COVERED_BY_METRIC_SIBLING - chunk itself lacks a Metric embedding but other chunks of
   the SAME document have Metric embeddings. Retrieval still reaches the document via siblings;
   the chunk is a coverage gap for chunk-level ANN, not a document-level gap.
C. DUPLICATE_LEGACY_ROW - chunk is a duplicate (same chunk_text_sha256) of a chunk that DOES have a
   Metric embedding; no information lost.
D. NOT_SEARCH_ELIGIBLE - chunk excluded by status (repealed/unknown outside current scope),
   language, or active-version rules; not in the active/current retrieval surface for the
   Metric-only cutover path.
E. REQUIRES_METADATA_RECONSTRUCTION - chunk lacks a Metric embedding AND lacks the structured
   metadata (legal_provisions / legal_document_metadata) needed to be useful even if re-embedded.
F. UNKNOWN - none of the above.

### Executable reconciliation queries (READ_ONLY SELECT; do not mutate)

-- total chunks and Metric-success
  select count(*) as total_chunks,
         count(*) filter (where exists (
           select 1 from embeddings e where e.chunk_id = sc.chunk_id
             and e.model = 'armenian-text-embeddings-2-large' and e.status = 'success'
         )) as metric_success_chunks
  from search_chunks sc;

-- the 162209 set
  with metric_missing as (
    select sc.chunk_id, sc.document_id, sc.norm_status, sc.content_domain,
           sc.language_code, sc.chunk_text_sha256, sc.fts_vector
    from search_chunks sc
    where not exists (
      select 1 from embeddings e where e.chunk_id = sc.chunk_id
        and e.model = 'armenian-text-embeddings-2-large' and e.status = 'success'
    )
  )
  select
    count(*) as missing_metric_total,
    count(*) filter (where not exists (
      select 1 from embeddings e where e.chunk_id = mm.chunk_id and e.status = 'success'
    )) as A_reembed_required,
    count(*) filter (where exists (
      select 1 from search_chunks s2 where s2.document_id = mm.document_id and s2.chunk_id <> mm.chunk_id
        and exists (select 1 from embeddings e where e.chunk_id = s2.chunk_id
          and e.model = 'armenian-text-embeddings-2-large' and e.status = 'success')
    )) as B_document_covered_by_sibling,
    count(*) filter (where mm.chunk_text_sha256 is not null and exists (
      select 1 from search_chunks s2 where s2.chunk_text_sha256 = mm.chunk_text_sha256
        and s2.chunk_id <> mm.chunk_id
        and exists (select 1 from embeddings e where e.chunk_id = s2.chunk_id
          and e.model = 'armenian-text-embeddings-2-large' and e.status = 'success')
    )) as C_duplicate_legacy_row,
    count(*) filter (where mm.norm_status in ('repealed','unknown')
                     or mm.norm_status is null) as D_not_search_eligible_status,
    count(*) filter (where not exists (
      select 1 from legal_provisions lp where lp.chunk_id = mm.chunk_id
    ) and not exists (
      select 1 from legal_document_metadata ldm where ldm.document_id = mm.document_id
    )) as E_requires_metadata_reconstruction
  from metric_missing mm;

(Add language / content_domain / active-version breakdowns as group-by variants of the above.)

## 4. Key interpretation - do NOT equate with missing legal content

A Qwen-only-or-unserved chunk row is NOT the same as missing legal content:
  - The BM25/FTS lane (always-on in search_legal_corpus_dual) retrieves these chunks by keyword
    regardless of embedding model, so they are NOT absent from search results today.
  - The Metric-only cutover path (V3) would drop ANN access to ~10.9% of chunks; that is a
    coverage gap for the Metric-only ANN lane, not a data-loss gap.
  - Re-embedding is warranted ONLY for class A (and possibly class E/F) chunks that are both
    search-eligible and not covered by siblings/duplicates. The expected A count is small
    (likely ~3 or fewer, bounded by the 3 not-success rows) pending live re-verification.

## 5. Coverage measurement (per spec)

Required measurements and their current status:
  - total chunks / Metric-success / Metric-failed / Qwen-success / both / neither: structurally
    defined; exact live counts require READ_ONLY DB access (BLOCKED_DATABASE_ACCESS for live re-count).
  - document coverage by Metric / legal-unit coverage by Metric / active-current corpus Metric
    coverage / extended-unknown / historical: same - require live SELECT.

## 6. Conclusion and classification of the figure

METRIC_COVERAGE_CLASSIFICATION:
  - Meaning: RECONCILED - 162209 = chunks with no successful armenian-text-embeddings-2-large
    embedding; reachable via FTS today; a coverage gap for the Metric-only ANN cutover lane only.
  - Live re-count: NOT_REVERIFIED_THIS_SESSION (no DB credentials) -> BLOCKED_DATABASE_ACCESS for
    the exact live figure; prior live capture (FINAL_03) is consistent but not re-asserted as PASS.
  - Re-embedding scope: NOT_AUTHORIZED. No re-embedding started. The true REEMBED_REQUIRED subset is
    expected to be small (bounded by the ~3 not-success rows plus any class E/F), to be confirmed
    by the READ_ONLY queries above before any re-embedding is proposed.

TRUE_METRIC_MISSING_COUNT = 162209 (per prior live capture; live re-verification required).
Do not trigger a full re-embed without explicit authorization and without running the
classification queries above to isolate the true REEMBED_REQUIRED subset.
