# 104 — Provision retrieval lane

The additive offline lane supports exact provision, article+part, article, document number/ARLIS ID, canonical/normalized title, case number, and date. It uses trusted metadata only; status and effective-date eligibility remain hard guards.

Parser fixtures: precision 1.00, recall 1.00 (60 positive, 60 negative). Synthetic exact-provision tests pass. Frozen exact-provision accuracy is 0 because the frozen pool has zero structured provision keys; body inference was not substituted.

Evidence: `supabase/functions/_shared/provision-retrieval-lane.ts`, `artifacts/prompt19_6_parser_fixtures.json`, `artifacts/prompt19_6_provision_mapping.json`.
