# 103 — Trusted provision metadata

`LegalCitationMetadata` uses only structured identity/title/citation fields, validated anchors/URLs, status, and dates. Body text cannot supply title, provision, authority, status, version, or effective dates.

Frozen coverage (588 unique chunks): document ID/title 588; validated document number 395; document version/provision key/source URL/authority/effective dates 0. Zero provision/version-quality coverage is a release blocker, not a parser result.

Evidence: `artifacts/prompt19_6_trusted_metadata_manifest.json`, `supabase/functions/_shared/legal-citation-metadata.ts`.
