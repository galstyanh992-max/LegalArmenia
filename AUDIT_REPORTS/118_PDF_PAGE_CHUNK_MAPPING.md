# 118 — PDF PAGE CHUNK MAPPING

## Status
Page mapping requires joining search_chunks (which have page_from/page_to) with source PDF files. The additive `legal_source_page_mappings` table is created in the schema migration. Full page mapping requires production backfill with text-window matching.

## Approach
1. Use normalized exact text matching between chunk text and PDF page text
2. Use rolling hashes for fuzzy page matching
3. Store match_confidence and match_method

## Current Coverage
- search_chunks.page_from/page_to: available in existing schema
- Source PDF page mapping: requires production backfill

## Artifacts
- Schema table `legal_source_page_mappings` created (migration 20260716000100)
- Dry-run: 0 page mappings (requires production text extraction)
