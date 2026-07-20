# LEGALARMENIA - Legal Review Guide (Phase 7)

Base: ad20a27. Date: 2026-07-20.
STATUS: BLOCKED_EXTERNAL_LEGAL_REVIEW until a human lawyer returns completed review.

## 1. Purpose

This guide is for a qualified Armenian-licensed lawyer (reviewer). The package asks the reviewer to
judge whether the system retrieved the CORRECT authority, the correct version, the correct
provision, whether the citation supports the claim, and whether any answer would be an unsafe legal
conclusion. The reviewer fields are filled ONLY by the human lawyer. AI does NOT fill reviewer fields.

## 2. Package contents

- 10_LEGAL_REVIEW_PACKAGE.csv - one row per query (280 queries). System-side fields are populated;
  reviewer fields are BLANK.
- Full candidate text and reranked order: AUDIT_REPORTS/artifacts/prompt19_3_review/
  review_batch_a.jsonl and review_batch_b.jsonl (2800 candidate-pair items; 10 candidates per query;
  retrieval_route/source_model/vector_score/reranker_score/system_rank are BLINDED in the reviewer
  batch to avoid anchoring).
- Corpus snapshot (redacted): AUDIT_REPORTS/artifacts/prompt19_2_corpus_snapshot.jsonl (592 rows;
  email/phone/secret-like tokens redacted; auth/tenant/private user content/service keys/embedding
  vectors excluded).

## 3. Per-query fields provided to the reviewer

System-side (populated):
- query, language (hy/ru/en/fr), intent, content_domain (knowledge_base/practice)
- intended status_scope (current/extended/historical), effective_at
- retrieved top candidates (candidate_id, candidate_text excerpt) - from the review batch file
- trusted citation metadata (citation_anchor, source_url, provision_key, canonical_citation where
  present in legal_provisions/legal_document_metadata) - from the review batch file
- reranked order - from the review batch file
- generated answer / claim-to-source mapping / system confidence - produced by running the live chain
  (pending credentials); until then the reviewer evaluates retrieval+metadata correctness.
- technical expected result (engineering gold): expected_document_ids, expected_provisions, answerable

Reviewer fields (BLANK - to be filled by the lawyer only):
- correct authority: YES/NO
- correct version: YES/NO
- correct provision: YES/NO
- citation supports claim: YES/NO
- material omission: YES/NO
- unsafe legal conclusion: YES/NO
- preferred answer (free text)
- comments (free text)
- reviewer name
- review date

## 4. Review protocol

1. Open 10_LEGAL_REVIEW_PACKAGE.csv and the review_batch_a.jsonl / review_batch_b.jsonl files.
2. For each query, read the retrieved candidates and trusted citation metadata (NOT the blinded
   route/model/score fields, which are hidden to avoid anchoring).
3. Compare against the intended status scope and the technical expected result.
4. Fill the reviewer fields in the CSV. Do NOT consult the engineering gold label as ground truth; the
   engineering label is provenance-marked and SECOND_LEGAL_REVIEWER_PENDING.
5. Flag any case where the system would produce an unsafe legal conclusion or cite repealed law as
   current. These are blocking findings.
6. Two reviewers (A and B) review independently; disagreements go to adjudication.

## 5. Status and non-negotiable rules

- Legal-review gate is BLOCKED_EXTERNAL_LEGAL_REVIEW until reviewers complete review and
  adjudication finishes (current state: reviewer_a_completed=0, reviewer_b_completed=0,
  adjudicated=0; legal_approval_claimed=false).
- Model review is NOT substituted for legal review. No engineering-only result is promoted to a
  legal-quality PASS.
- The reviewer must be a real lawyer; AI does not fill reviewer fields.
- Do not deploy or cut over search based on this package alone.

## 6. Acceptance for the legal gate

The legal-review gate passes only when: reviewers A and B complete all assigned cases; adjudication
resolves disagreements; no blocking unsafe-legal-conclusion finding remains; legal_approval is
recorded by a named human reviewer with a date. Until then STATUS stays BLOCKED_EXTERNAL_LEGAL_REVIEW.
