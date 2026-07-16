# 121 — DUPLICATE SOURCE RESOLUTION

## Results

| Classification | Count |
|---------------|-------|
| EXACT_FILE_DUPLICATE | 7 (SHA-256 matches, all empty files) |
| VERSION_VARIANT | 5 (same numeric ID, different dates) |
| EXACT_TEXT_DUPLICATE | 0 |
| SOURCE_MIRROR | 0 |
| TRANSLATION_VARIANT | 0 |
| ADJACENT_CHUNK | 0 |
| SAME_PROVISION_DIFFERENT_SPAN | 0 |
| LEGITIMATE_DISTINCT_SOURCE | 183,673 |
| **Total duplicate groups** | **12** |

## Resolution Rules Applied
- Empty file duplicates: 7 pairs of 0-byte PDFs (SHA `e3b0c44298fc...`)
- Version variants: 5 numeric IDs with multiple PDFs (different dates)
- All other files are legitimate distinct sources

## Artifacts
- `AUDIT_REPORTS/artifacts/duplicate_resolution.json` — Full resolution data
