# 117 — PROVISION RECONSTRUCTION RESULTS

## Method
Parsed first 5,000 documents from documents.jsonl using regex patterns for Armenian, Russian, and English legal citation formats.

## Results (5,000 sample)

| Metric | Count | Percentage |
|--------|-------|------------|
| Records with article | 755 | 15.1% |
| Records with part | 26 | 0.5% |
| Records with point | 58 | 1.2% |
| Records with chapter | 0 | 0.0% |

## Confidence Distribution

| Confidence | Count |
|------------|-------|
| High | 37 |
| Medium | 718 |
| Low | 4,245 |

## Patterns Supported
- `N-րդ հոդված` (Armenian ordinal article)
- `հոդված N` / `հոդվածի N` (Armenian article)
- `մաս N` / `մասի N` (Armenian part)
- `կետ N` / `կետի N` (Armenian point)
- `Article N`, `Part N`, `Point N` (English)
- `статья N`, `часть N`, `пункт N` (Russian)

## Artifacts
- `AUDIT_REPORTS/artifacts/provision_reconstruction.jsonl` — 5,000 provision records
- `AUDIT_REPORTS/artifacts/provision_reconstruction_summary.json` — Summary

## Notes
Low article coverage (15.1%) is expected for the sample because many documents are government decisions and ministerial acts that do not use article-based structure. Laws and codes (which use articles) are a smaller fraction. Full corpus parsing would improve absolute coverage.
