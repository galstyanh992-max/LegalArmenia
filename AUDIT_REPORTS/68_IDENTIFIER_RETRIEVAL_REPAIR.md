# 68 — Identifier retrieval repair

Added audited levels: `EXACT_FULL_PROVISION`, `EXACT_ARTICLE`, `EXACT_DOCUMENT_NUMBER`, `EXACT_TITLE`, `PARTIAL_PROVISION`, `NORMALIZED_TITLE`, `DATE_MATCH`, `CASE_NUMBER_MATCH`.

Only citation metadata, title, citation anchor and validated structured fields can activate the lane. Candidate body text cannot claim status, authority, dates or identifiers. Missing trusted metadata leaves the semantic/FTS fallback unchanged and emits reason codes.
