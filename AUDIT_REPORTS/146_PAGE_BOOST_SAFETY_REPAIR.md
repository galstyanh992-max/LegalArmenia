# 146 — Page Boost Safety Repair

## Problem

V4 scorer activated page boost using fallback search_chunks.page_from when legal_source_page_mappings coverage = 0%. This created an unintended 0.01 bonus without trusted mapping.

## Repair

### pageMappingScore function

Before:
`
function pageMappingScore(row): number {
  const v3 = row as MetricV3CorpusRow;
  if (v3.page_from_physical != null) return 1.0;
  // Fall back to search_chunks page_from — UNTRUSTED
  const sc = row as any;
  if (sc.page_from != null || sc.page_to != null) return 0.50;
  return 0.0;
}
`

After:
`
function pageMappingScore(row): number {
  // Only trust legal_source_page_mappings (via V3 page_from_physical)
  // Do NOT fall back to search_chunks.page_from — not trusted PDF mapping
  const v3 = row as MetricV3CorpusRow;
  if (v3.page_from_physical != null) return 1.0;
  return 0.0;
}
`

### pageScore calculation

Before: options.pageMappingBoost === false ? 0 : pageMappingScore(row) * 0.02 (boost ON by default)
After: options.pageMappingBoost === true ? pageMappingScore(row) * 0.02 : 0 (boost OFF by default)

## Required Behavior Verified

- page_mapping_state = ABSENT when no trusted mapping → page_mapping_bonus = 0 ✓
- No fallback to search_chunks.page_from ✓
- page boost OFF by default (pageMappingBoost must be explicitly true) ✓
- page_from_physical from legal_source_page_mappings is the only trusted source ✓
- No missingness penalty (absence → 0, not negative) ✓

## Test Results

- No mapping → page_mapping_score = 0 ✓
- Legacy page_from fallback → page_mapping_score = 0 ✓ (fallback ignored)
- Trusted page_from_physical → page_mapping_score > 0 ✓

## Status

PASS — page boost hard-disabled without trusted mapping, fallback removed, default off.