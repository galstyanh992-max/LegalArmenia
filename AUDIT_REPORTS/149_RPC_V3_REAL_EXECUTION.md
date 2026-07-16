# 149 — RPC V3 Real Execution

## Environment

- Local Docker Supabase Postgres
- Fixture data: 3 documents, 3 search_chunks, 2 legal_document_metadata rows

## Test Cases Executed

### 1. FTS query (constitution freedom speech)

`
SELECT document_id, authority_type, source_url, page_source_url, metadata_confidence, page_from_physical
FROM search_legal_corpus_metric_v3('constitution freedom speech', null, null, 'current', null, 15, 100, 50);
`

Result: 1 row
- document_id: a0000000-...001
- authority_type: national_assembly (ENRICHED via repaired join)
- source_url: http://www.arlis.am/...DocID=100000 (ENRICHED)
- page_source_url: same (coalesced)
- metadata_confidence: high
- page_from_physical: NULL (no trusted page mapping — correct, 0% coverage)

### 2. Identifier lookup (doc number 100000)

Result: 1 row, match_reason = identifier_exact, authority_type = national_assembly

### 3. Unknown status — current scope

Query: 'unconfirmed decision'
Result: 0 rows (unknown status filtered in current scope) ✓

### 4. Unknown status — extended scope

Result: 1 row, norm_status = unknown ✓

### 5. Repealed — historical scope

Result: 1 row, norm_status = repealed ✓

## Output Fields Verified

| Field | Present | Correct |
|-------|---------|---------|
| document_id | ✓ | ✓ |
| authority_type | ✓ | ✓ (enriched from legal_document_metadata) |
| source_url | ✓ | ✓ (coalesced meta_source_url + chunk source_url) |
| page_source_url | ✓ | ✓ |
| provision_key | ✓ | ✓ |
| metadata_confidence | ✓ | ✓ |
| page_from_physical | ✓ | ✓ (NULL when no mapping) |
| status warning | ✓ | ✓ |

## Authority Enrichment Proof

Before fix (ldm.source_file_id = sc.source_document_id::text): authority_type = NULL
After fix (ldm.document_id = sc.document_id): authority_type = national_assembly

## Source Enrichment Proof

Before fix: source_url from metadata = NULL
After fix: source_url = http://www.arlis.am/DocumentView.aspx?DocID=100000

## Ambiguous Mapping

No ambiguous mappings in fixture data. The LEFT JOIN preserves one-to-many: if multiple ldm rows match the same document_id, all would be returned (quarantine not triggered because review_status filter limits to pending/approved).

## Status

PASS — RPC V3 executes against real Postgres rows, enrichment verified, all output fields present.