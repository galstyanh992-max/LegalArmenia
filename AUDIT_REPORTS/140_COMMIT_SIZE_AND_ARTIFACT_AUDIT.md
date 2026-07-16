# 140 — COMMIT SIZE AND ARTIFACT AUDIT

## Commit Overview
- Commit: 01ad8a7
- Files changed: 63
- Insertions: 398,676
- Deletions: 0

## 20 Largest Files by Git Object Size

| # | File | Bytes | Lines | Classification |
|---|------|-------|-------|----------------|
| 1 | artifacts/source_inventory.jsonl | 185,009,547 | 184,277 | **LARGE ARTIFACT — REMOVE** |
| 2 | artifacts/source_matching.jsonl | 114,002,669 | 183,685 | **LARGE ARTIFACT — REMOVE** |
| 3 | artifacts/source_metadata_adapters.jsonl | 8,784,242 | 10,000 | **LARGE ARTIFACT — REMOVE** |
| 4 | artifacts/version_lineage.jsonl | 2,550,000 | 10,000 | **LARGE ARTIFACT — REMOVE** |
| 5 | artifacts/provision_reconstruction.jsonl | 2,235,597 | 5,000 | **LARGE ARTIFACT — REMOVE** |
| 6 | artifacts/pdf_classification_sample.jsonl | 1,786,719 | 2,000 | **LARGE ARTIFACT — REMOVE** |
| 7 | migrations/20260716000200_metric_rpc_v3.sql | 19,404 | 418 | SQL migration |
| 8 | _shared/deterministic-search-v4.ts | 10,653 | 252 | Source code |
| 9 | migrations/20260716000100_additive_legal_metadata_schema.sql | 9,610 | 232 | SQL migration |
| 10 | scripts/prompt19_7/pdf_classification.py | 7,674 | 229 | Script |
| 11 | scripts/prompt19_7/source_adapters.py | 6,853 | 196 | Script |
| 12 | scripts/prompt19_7/provision_reconstruction.py | 6,720 | 197 | Script |
| 13 | scripts/prompt19_7/source_inventory.py | 4,974 | 105 | Script |
| 14 | scripts/prompt19_7/source_matching.py | 4,727 | 138 | Script |
| 15 | artifacts/source_inventory_summary.json | 3,999 | 87 | Summary (keep) |
| 16 | artifacts/duplicate_resolution.json | 3,916 | 84 | Summary (keep) |
| 17 | _shared/deterministic-search-v4.test.ts | 3,726 | 105 | Test |
| 18 | scripts/prompt19_7/version_lineage.py | 3,711 | 100 | Script |
| 19 | _shared/metric-search-v3.ts | 3,273 | 99 | Source code |
| 20 | scripts/prompt19_7/dry_run_backfill.py | 3,229 | 100 | Script |

## Total Artifact Size in Git
~314 MB of JSONL artifacts committed. These should be stored outside Git.

## File Classification

| Classification | Count | Notes |
|---------------|-------|-------|
| Source code (TS) | 3 | metric-search-v3.ts, deterministic-search-v4.ts, deterministic-search-v4.test.ts |
| SQL migration | 2 | Additive schema, RPC V3 |
| SQL rollback | 2 | Symmetric rollback files |
| Test | 1 | metric-rpc-v3.contract.test.ts |
| Python scripts | 10 | Inventory, classification, matching, etc. |
| Reports (MD) | 27 | Reports 112-135, state, ledger, decision log |
| Summary JSON | 8 | Summary files (small, keep) |
| **Large JSONL artifacts** | **6** | **~314 MB — should be removed from Git** |
| Artifact manifest | 2 | manifest.json, failure_ledger.jsonl |

## Sensitive Content Check

| Check | Result |
|-------|--------|
| PDF files committed | NONE |
| Full extracted legal text | NONE (provisions contain metadata only, not full text) |
| Candidate pools | NONE |
| Secrets | NONE |
| .env files | NONE |
| Local credentials | NONE |
| **Sensitive absolute paths** | **YES — 184,277 absolute paths to D:\arlis_pdfs1 in source_inventory.jsonl** |
| Source filenames | YES — in JSONL artifacts (Armenian legal document filenames) |

## Artifact Removal Plan

The following 6 files should be removed from Git and stored externally:
1. `source_inventory.jsonl` (185 MB) — replace with SHA-256 manifest
2. `source_matching.jsonl` (114 MB) — replace with summary only
3. `source_metadata_adapters.jsonl` (8.8 MB) — replace with summary
4. `version_lineage.jsonl` (2.5 MB) — replace with summary
5. `provision_reconstruction.jsonl` (2.2 MB) — replace with summary
6. `pdf_classification_sample.jsonl` (1.8 MB) — replace with summary

**Replacement**: Summary JSON files already exist for each. SHA-256 checksums should be recorded in the artifact manifest. Raw JSONL should be stored outside the Git repository (e.g., in Supabase Storage or local artifact directory excluded from Git).

## Verdict
6 large artifacts (~314 MB) with sensitive source paths should be removed from Git. Summary files and checksums are sufficient as evidence.
