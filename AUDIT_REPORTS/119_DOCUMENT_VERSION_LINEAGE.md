# 119 — DOCUMENT VERSION LINEAGE

## Method
Grouped PDFs by numeric ID from filename. Within each group, sorted by date (descending) to determine version sequence. Most recent = current version.

## Results

| Metric | Value |
|--------|-------|
| Total records | 183,685 |
| With version info | 74,532 |
| Current versions | 74,527 |
| Superseded versions | 5 |
| Unknown (no numeric ID) | 109,153 |
| Multi-version groups | 5 |

## Version Confidence
- High: 5 records (in multi-version groups)
- Medium: 74,527 records (single version, date-ordered)
- Low: 109,153 records (no numeric ID)

## Artifacts
- `AUDIT_REPORTS/artifacts/version_lineage.jsonl` — 10,000 sample records
- `AUDIT_REPORTS/artifacts/version_lineage_summary.json` — Summary
