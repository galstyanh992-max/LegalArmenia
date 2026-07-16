# 113 — PDF CORPUS CLASSIFICATION

## Method
Statistical sample of 2,000 PDFs (seed=42) from 183,685 non-empty PDFs.
Classified using PyMuPDF (fitz) with text layer, bookmark, and metadata detection.

## Results

| PDF Type | Count | Percentage |
|----------|-------|------------|
| TEXT_BASED | 1,974 | 98.7% |
| SCANNED | 0 | 0.0% |
| MIXED | 26 | 1.3% |
| ENCRYPTED | 0 | 0.0% |
| CORRUPTED | 0 | 0.0% |
| EMPTY | 0 | 0.0% |

## Text Layer

| Metric | Value |
|--------|-------|
| Text layer present | 2,000 (100%) |
| Text layer absent | 0 (0%) |
| OCR required | 26 (1.3%) |

## Structure Detection

| Feature | Count | Percentage |
|---------|-------|------------|
| Bookmarks | 294 | 14.7% |
| TOC detected | 294 | 14.7% |
| Articles detected | 1,534 | 76.7% |
| Tables detected | 0 | 0.0% |

## Page Statistics

| Metric | Value |
|--------|-------|
| Average pages | 7.3 |
| Median pages | 2 |
| Max pages | 282 |
| Min pages | 1 |

## Extrapolation (183,685 PDFs)

| Estimate | Value |
|----------|-------|
| Text-based | ~181,299 (98.7%) |
| Scanned | ~0 |
| Mixed (OCR needed) | ~2,388 (1.3%) |

## Artifacts
- `AUDIT_REPORTS/artifacts/pdf_classification_sample.jsonl` — 2,000 classified records
- `AUDIT_REPORTS/artifacts/pdf_classification_summary.json` — Summary

## Verdict
Nearly all PDFs have usable text layers. OCR needed for ~1.3% of mixed PDFs. Article structure detected in 76.7% of sample.
