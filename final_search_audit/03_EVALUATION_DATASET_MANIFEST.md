# LEGALARMENIA - Evaluation Dataset Manifest (Phase 3)

Base: ad20a27. Branch: codex/rag-citation-retrieval-closure. Date: 2026-07-20.
Status: FROZEN engineering gold. LEGAL_REVIEW = PENDING (not complete).

## 1. Dataset inventory

All datasets live under AUDIT_REPORTS/artifacts/. Source manifest: prompt19_2_dataset_manifest.json
(status ENGINEERING_GOLD_PENDING_LEGAL_REVIEW; release_eligible=false; legal_review_complete=false).

| Dataset | File | Rows | sha256 | Purpose |
|---------|------|------|--------|---------|
| Frozen gold (all) | prompt19_2_frozen_gold.jsonl | 280 | 37421cb2a6ec62a01ea76240c4180915382e9f731a24fe8abc55d2fcc59994da | Full frozen gold set |
| Gold train | prompt19_2_gold_train.jsonl | 168 | 5baa1cd1c0ce51978a7691712d2aa0bfc5298683b40077ac516dc25f78d0af13 | Train split |
| Gold dev | prompt19_2_gold_dev.jsonl | 56 | 97d24eec84c692cfa512a985b75bb06f946e3d3e4ff63ec33d2098257114f8ce | Dev split |
| Gold test (blind) | prompt19_2_gold_test.jsonl | 56 | 97f17850bed91eff2b7654b236a0b10f3e0f5a932109996ae25cb7b316680f89 | Blind/frozen test split |
| Candidate pools | prompt19_2_candidate_pools.jsonl | 280 | 7e12187cd4c0d3c8bf14faa29b00d78a53dddf8fba139f9c19458907bbe0ba7d | Per-query candidate pools (50) |
| Blinded candidate pools | prompt19_2_blinded_candidate_pools.jsonl | 280 | 4a217209c3af42273e4320017f1d89d3d0ae726fc489f4fd2ce34aa390b9fe58 | Blinded (route/model/score fields removed) |
| Corpus snapshot | prompt19_2_corpus_snapshot.jsonl | 592 | 653a65988dab0a027410108c108dd76ec9d2e8db4902a5d1d2f42799b4044858 | Redacted corpus sample |
| Injection fixtures | prompt19_2_injection_fixtures.json | 10 cases | 4f6c145f0fc520a65e6f2c62789fb3c2cca24acaab3675091ac31749c6545f51 | Citation-injection adversarial cases |
| Dataset manifest | prompt19_2_dataset_manifest.json | - | 5d9613adae4685f398609e37bdc6d9e53594a934f5e5527d474d4c11e289e460 | Construction manifest |
| Corpus manifest | prompt19_2_corpus_snapshot_manifest.json | - | f6c3cad9ba2478905d3e2117215f73705249bca7ace8867170ac3918a4000ca7 | Corpus snapshot manifest |

Dataset manifest declared hashes (construction-time):
  dataset_sha256 = 9d324b10...a0381
  corpus_snapshot_sha256 = 27bfa2ba...1fd251
  candidate_pool_sha256 = dca97f24...b373b7
  blinded_pool_sha256 = 0bc062e8...87cd6
(Match against current file hashes is expected for the blinded/candidate files; the frozen-gold and
corpus files are recomputed here independently as 37421cb2... and 653a6598... Note: the manifest
dataset_sha256 is a construction hash of a different artifact set than the raw jsonl files, so it is
not expected to equal the per-file sha256 above.)

## 2. Required query groups (coverage)

intent_counts (from manifest, n=280):
  armenian_semantic        100
  exact_law_article         30
  russian_to_armenian       25
  name_date_case_number     20
  historical_law            20
  active_vs_repealed        20
  unknown_status_discovery  20
  no_answer                 25
  prompt_injection_candidate 10
  duplicate_near_duplicate   10

Required groups from the Phase 3 spec mapped to the intent set:
  Armenian natural language      -> armenian_semantic (100)
  Russian queries                -> russian_to_armenian (25)
  English/French ECHR queries    -> covered via ECHR corpus_snapshot strata (practice_case=45);
                                    ECHR-specific queries are in the candidate pools. (Sparse; see gap below.)
  article-number queries         -> exact_law_article (30)
  document-number queries        -> name_date_case_number (20)
  exact title queries            -> covered within armenian_semantic + exact_law_article
  typo queries                   -> GAP: no dedicated typo intent. Recommend adding a typo group before cutover.
  vague questions                -> partially in no_answer (25) and unknown_status_discovery (20)
  irrelevant questions           -> partially in no_answer; no dedicated irrelevant-query rejection set. GAP.
  status/effective-date queries  -> active_vs_repealed (20) + historical_law (20) + unknown_status_discovery (20)
  conflicting-source queries     -> corpus strata active_conflict=25 + repealed_conflict=25
  missing-authority queries      -> no_answer (25)
  citation-injection queries     -> prompt_injection_candidate (10) + injection_fixtures (10)

Gaps to close before cutover (engineering): typo queries, irrelevant-query rejection set,
English/French ECHR semantic queries (currently sparse). These do not block the citation-injection
or reranker gates but they narrow retrieval-evaluation confidence.

## 3. Split integrity (leakage checks)

split_counts: train=168, dev=56, test=56 (sums to 280).
Query-id overlap across splits (recomputed this session from the jsonl files):
  train-intersect-dev   = 0
  train-intersect-test  = 0
  dev-intersect-test    = 0
Manifest-declared near_duplicate_split_leakage = 0.
production_writes = 0 (read-only construction).

## 4. Label provenance and separation

- Labels are engineering-graded (graded_relevance, expected_document_ids, status_scope). They are
  NOT lawyer-reviewed. legal_review_complete=false; reviewer_a_completed=0; reviewer_b_completed=0;
  adjudicated=0 (prompt19_4_legal_review_status.json).
- Engineering labels are strictly separated from any legal-reviewed labels (none exist yet).
  No engineering-only result is promoted to a legal-quality PASS.
- Expected-answer text is NOT copied into candidate text: candidate pools are real corpus chunks
  sampled read-only; gold labels reference expected_document_ids, not candidate text injection.
- Obsolete-law queries are identified: historical_law (20) + active_vs_repealed (20) carry
  status_scope; corpus strata repealed=65, repealed_conflict=25, unknown=65.
- Expected status scope is recorded per case (status_scope field). Expected article/part/point is
  recorded where structured metadata exists (provision_key in legal_provisions where present).

## 5. Frozen manifest

FROZEN_EVALUATION_MANIFEST:
  base_commit: ad20a27bc32ba40c364fbe39d969285d4d17171b
  gold_total: 280
  train: 168 | dev: 56 | test: 56
  candidate_pool_size: 50
  corpus_snapshot_rows: 592 (unique_documents=564, unique_chunks=592)
  metric_embedding_model: armenian-text-embeddings-2-large
  metric_embedding_dimension: 1024
  query_id_leakage: 0 (train/dev/test disjoint)
  near_duplicate_split_leakage: 0
  production_writes: 0
  legal_review_complete: false
  frozen_gold_sha256: 37421cb2a6ec62a01ea76240c4180915382e9f731a24fe8abc55d2fcc59994da
  corpus_snapshot_sha256: 653a65988dab0a027410108c108dd76ec9d2e8db4902a5d1d2f42799b4044858
  test_set_status: FROZEN (do not tune against test; train/dev only for any repair)

## 6. Honest limits

- The frozen gold is ENGINEERING gold. It cannot substitute for legal review.
- ECHR English/French semantic coverage is sparse; add before cutover.
- Typo and irrelevant-query rejection sets are thin; add before cutover.
- Corpus snapshot is a 592-row REDACTED sample (secrets/PII redacted), not the full corpus; it is
  sufficient for retrieval logic evaluation, not for full corpus coverage measurement.
