# 126 — METRIC RPC V3 IMPLEMENTATION

## Function
`public.search_legal_corpus_metric_v3`

## Migration
`supabase/migrations/20260716000200_metric_rpc_v3.sql`

## Additive Guarantee
V3 does NOT modify:
- `search_legal_corpus_metric` (V1)
- `search_legal_corpus_metric_v2` (V2)
- `search_legal_corpus_dual` (legacy)

## New Features (vs V2)
1. **Provision lane**: Exact trusted provision matching using article/part/point extraction
2. **Legal provision lane**: Joins `legal_provisions` additive table for high-confidence provision matches
3. **Provision query parameter**: `p_provision_query` for explicit provision specification
4. **Metadata enrichment**: Joins `legal_provisions`, `legal_document_metadata`, `legal_source_page_mappings`
5. **Authority type**: Returns authority_type from legal_document_metadata
6. **Page mapping**: Returns page_from_physical/page_to_physical from legal_source_page_mappings
7. **Metadata confidence**: Returns metadata_confidence and metadata_source
8. **Identifier match type**: Returns identifier_match_type and identifier_match_score

## Return Columns (V3 additions in bold)
- All V2 columns
- **identifier_match_type**
- **identifier_match_score**
- **provision_key**
- **canonical_citation**
- **metadata_confidence**
- **metadata_source**
- **document_version_id**
- **authority_type**
- **page_from_physical**
- **page_to_physical**

## Lane Priority (RRF weights)
1. provision_exact: 4.0 / (60 + rank)
2. legal_provision: 3.5 / (60 + rank)
3. identifier: 3.0 / (60 + rank)
4. metric_ann: 1.5 / (60 + rank)
5. armenian_fts: 1.0 / (60 + rank)

## Client
`supabase/functions/_shared/metric-search-v3.ts` — TypeScript client for V3 RPC

## Tests
`supabase/functions/_tests/metric-rpc-v3.contract.test.ts` — 4 tests PASS

## Rollback
`supabase/rollback/20260716000200_metric_rpc_v3_rollback.sql` — Drops V3 function only
