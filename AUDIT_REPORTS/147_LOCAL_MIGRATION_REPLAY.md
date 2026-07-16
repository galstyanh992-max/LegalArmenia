# 147 — Local Migration Replay

## Environment

- Docker local Supabase (Postgres 17.6.1)
- Container: supabase_db_avmgtsonawtzebvazgcr
- Port: 54322

## Pre-Replay State

- Migrations applied: 11 (through 20260715024359)
- Prompt 19.7 migrations NOT applied
- Functions: search_legal_corpus_metric (V1), search_legal_corpus_metric_v2 (V2)
- Tables: 3 legal_% tables (legal_documents, legal_edges, legal_units)
- Corpus: 3 documents, 3 search_chunks, 0 cases

## Replay Steps

1. Applied 20260716000100_additive_legal_metadata_schema.sql via docker cp + psql -f
2. Applied 20260716000200_metric_rpc_v3.sql via docker cp + psql -f

## Post-Replay Verification

| Check | Result |
|-------|--------|
| Additive legal tables | 11 (8 new + 3 pre-existing) |
| RPC V3 exists | YES |
| V1 unchanged | YES |
| V2 unchanged | YES |
| Destructive DDL | NONE |
| Corpus DML | NONE |
| Status rewrite | NONE |
| Embedding changes | NONE |
| ECHR/Venice/Qwen mutation | NONE |
| Row counts | 3 docs, 3 chunks, 0 cases (unchanged) |
| Replay deterministic | YES (second replay produced same result) |

## Schema Diff

8 new additive tables:
- legal_source_files
- legal_document_metadata (with document_id uuid column for correct join)
- legal_document_versions
- legal_provisions
- legal_source_page_mappings
- legal_metadata_reconstruction_runs
- legal_metadata_failures
- legal_metadata_review_actions

1 new function: search_legal_corpus_metric_v3

## Hashes

- meta_sql SHA256: 1518D76420E789766CE23246DBACEC3E6F5C7172D4948A505D4665B3B22C69E7
- v3_sql SHA256: 4997ACC3313F70FECDF0BB51B6475684884806486C509AA31A4B3AA12B2420FC

## Status

PASS — migration replay successful, additive only, no destructive changes, deterministic.