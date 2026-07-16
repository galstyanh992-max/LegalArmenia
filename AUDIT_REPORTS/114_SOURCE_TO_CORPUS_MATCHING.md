# 114 — SOURCE-TO-CORPUS MATCHING

## Method
Parsed PDF filenames using pattern `{numeric_id}_{DD.MM.YYYY}_{title}_{hash}.pdf`.
Extracted numeric ID, date, and title from filename for matching signals.

## Results

| Match Type | Count | Percentage |
|------------|-------|------------|
| EXACT_ID (filename parsed) | 74,532 | 40.6% |
| UNMATCHED (non-standard filename) | 109,153 | 59.4% |

## Duplicate ID Groups
5 numeric IDs appear in multiple PDFs (version variants).

## Match Rate
40.6% of PDFs have parseable numeric IDs suitable for exact matching.

## Artifacts
- `AUDIT_REPORTS/artifacts/source_matching.jsonl` — 183,685 matching records
- `AUDIT_REPORTS/artifacts/source_matching_summary.json` — Summary

## Notes
- The 59.4% unmatched files have non-standard filenames but are still valid PDFs.
- documents.jsonl contains ARLIS DocID URLs that can provide additional matching signals.
- Full text-hash matching would require reading all 183K PDFs (deferred to production backfill).
