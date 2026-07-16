# 148 — Rollback Replay

## Rollback Steps

1. Dropped function: DROP FUNCTION IF EXISTS public.search_legal_corpus_metric_v3(...)
2. Dropped 8 additive tables in reverse order (CASCADE):
   - legal_metadata_review_actions
   - legal_metadata_failures
   - legal_metadata_reconstruction_runs
   - legal_source_page_mappings
   - legal_provisions
   - legal_document_versions
   - legal_document_metadata
   - legal_source_files

## Post-Rollback Verification

| Check | Result |
|-------|--------|
| Functions remaining | 2 (V1 + V2, V3 dropped) |
| Legal tables remaining | 3 (pre-existing: legal_documents, legal_edges, legal_units) |
| V1 unchanged | YES |
| V2 unchanged | YES |
| Corpus unchanged | YES (3 docs, 3 chunks, 0 cases) |
| No corpus DML | CONFIRMED |
| No V1/V2/dual modification | CONFIRMED |

## Second Replay

After rollback, re-applied both migrations:
- All 8 tables recreated
- V3 function recreated
- RPC V3 executed successfully with enrichment
- Row counts unchanged

## Rollback Diff

- Dropped: 8 tables, 1 function
- Preserved: V1, V2, all corpus data, all baseline tables
- No cascading drops to non-additive objects

## Status

PASS — rollback drops only new objects, V1/V2/corpus unchanged, replay deterministic.