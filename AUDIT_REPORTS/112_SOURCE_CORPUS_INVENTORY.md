# 112 — SOURCE CORPUS INVENTORY

## Source Root
`D:\arlis_pdfs1` (read-only)

## Summary

| Metric | Value |
|--------|-------|
| Total files | 184,277 |
| Total size | 35,964 MB (~36 GB) |
| SHA-256 duplicates | 7 (all empty files) |
| Unreadable | 0 |
| Corrupted | 0 |
| Encrypted | 0 |
| Empty | 8 |

## By Format

| Extension | Count |
|-----------|-------|
| .pdf | 183,693 |
| .jsonl | 579 |
| .json | 3 |
| .csv | 1 |
| .py | 1 |

## By Folder

| Folder | Count |
|--------|-------|
| (root) | 183,696 |
| ECHR_hy_translation_state | 581 |

## By Language

| Language | Count |
|----------|-------|
| hy (Armenian) | 178,768 |
| ru (Russian) | 3,602 |
| unknown | 1,915 |

## By Source Family

| Family | Count |
|--------|-------|
| arlis_general | 184,097 |
| government_decision | 101 |
| law_code | 72 |
| ECHR | 7 |

## Non-PDF Files

- `documents.jsonl` (7.9 GB) — Extracted legal document text with ARLIS DocID URLs
- `echr_2_0_0_unstructured_cases.json` (1 GB) — ECHR case data
- `move_report.csv` (832 KB) — File move/match report
- `ECHR_hy_translation_state/` — ECHR Armenian translation state (units.jsonl, translated_units.jsonl, failed_units.jsonl, summary.json, verification.json)

## Artifacts
- `AUDIT_REPORTS/artifacts/source_inventory.jsonl` — Per-file inventory (184,277 records)
- `AUDIT_REPORTS/artifacts/source_inventory_summary.json` — Summary statistics

## Verdict
SOURCE_CORPUS_INVENTORY_COMPLETE — METADATA_RECONSTRUCTION_FEASIBLE — CONTINUING_LOOP
