# 115 — METADATA RECOVERY FEASIBILITY

## Assessment

| Dimension | Feasible | Coverage Estimate | Notes |
|-----------|----------|-------------------|-------|
| Document ID | Yes | 40.6% from filename | 74,532 parseable ARLIS IDs |
| Document title | Yes | 100% from filename | All filenames contain title text |
| Document date | Yes | 40.6% from filename | DD.MM.YYYY in filename |
| Document type | Yes | 70%+ from title | Detectable from Armenian keywords |
| Authority | Yes | 63% from title | Detectable from issuing body keywords |
| Article/part/point | Partial | 15.1% from text sample | Requires full text parsing |
| Source URL | Yes | 40.6% from DocID | ARLIS URL pattern |
| Version lineage | Partial | 0.003% multi-version | 5 groups with multiple versions |
| Effective dates | No | 0% | Not extractable from filename alone |

## Conclusion
METADATA_RECONSTRUCTION_FEASIBLE — Primary metadata (ID, title, date, type, authority) recoverable from filenames. Provision metadata requires text parsing. Full backfill recommended in production with streaming text extraction.
