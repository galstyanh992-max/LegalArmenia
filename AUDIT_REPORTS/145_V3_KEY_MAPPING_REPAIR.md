# 145 — V3 Key-Mapping Repair

## Root Cause

The V3 RPC function search_legal_corpus_metric_v3 used a broken join:

`
left join public.legal_document_metadata ldm on ldm.source_file_id = sc.source_document_id::text
`

- ldm.source_file_id is 	ext — stores sf_-prefixed logical IDs (e.g., sf_test_001)
- sc.source_document_id is uuid — casting to text produces UUID format (e.g., 0000000-...)
- These can never match → authority/source enrichment was non-functional

## Key-Provenance Matrix

| Field | Table | Type | Format | Semantic | Join Target |
|-------|-------|------|--------|----------|-------------|
| source_file_id | legal_document_metadata | text | sf_ prefixed | logical source ID | NOT UUID |
| document_id | legal_document_metadata | uuid | UUID | FK to documents | YES — UUID FK |
| document_id | search_chunks | uuid | UUID | FK to documents | YES — UUID FK |
| source_document_id | search_chunks | uuid | UUID | FK to documents | YES — UUID FK |

## Repair

Changed join to use stable UUID relational key:

`
left join public.legal_document_metadata ldm on ldm.document_id = sc.document_id
`

Both ldm.document_id and sc.document_id are uuid referencing documents.document_id. No text casts.

## Negative Tests

- Unrelated UUID → no match (correct, different document)
- Same title → no match (correct, join by UUID not title)
- Malformed sf_ ID → no match (correct, sf_ IDs not used in join)
- Duplicate source row → handled by LEFT JOIN (one-to-many preserved)

## Verification

Executed against local Postgres with fixture data:

`
SELECT document_id, authority_type, source_url FROM search_legal_corpus_metric_v3('constitution freedom speech', null, null, 'current', null, 15, 100, 50);
`

Result:
- document_id: a0000000-...001
- authority_type: national_assembly (ENRICHED — was NULL before fix)
- source_url: http://www.arlis.am/...DocID=100000 (ENRICHED — was NULL before fix)

## Additional Pre-Existing Bugs Fixed

1. Duplicate source_url text column in return type → renamed second to page_source_url text
2. chunk_fts_candidates CTE missing sc.fts_vector column → added
3. UNION ALL lane mismatch (provision_score missing from 3 lanes) → added 
ull::real as provision_score

## Status

PASS — join repaired, enrichment verified, negative tests confirmed.