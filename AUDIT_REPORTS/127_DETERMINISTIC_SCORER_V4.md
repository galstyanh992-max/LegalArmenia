# 127 — DETERMINISTIC SCORER V4

## Module
`supabase/functions/_shared/deterministic-search-v4.ts`

## Additive Guarantee
V4 does NOT modify:
- `deterministic-search-v2.ts`
- `deterministic-search-v3.ts`

## New Features (vs V3)
1. **Page mapping boost**: Boosts chunks with confirmed PDF page mapping
2. **Version validity guard**: Penalizes chunks with invalid version for reference date
3. **Authority taxonomy boost**: Boosts high-authority sources (constitution > law > government)
4. **Canonical source preference**: Prefers official ARLIS source
5. **Metadata confidence integration**: Uses V3 metadata_confidence field
6. **V4-specific return fields**: page_mapping_score, version_validity_score, authority_score, canonical_source_score

## Ablations Supported
- V4 full
- V4 without provision metadata
- V4 without PDF mapping
- V4 without version lineage
- V4 without authority
- V4 without duplicate grouping
- V4 without canonical source
- V4 without sanitizer

## No-Answer Decision V4
Adds `VERSION_NOT_EFFECTIVE` reason to no-answer logic.

## Tests
`supabase/functions/_shared/deterministic-search-v4.test.ts` — 6 tests PASS
