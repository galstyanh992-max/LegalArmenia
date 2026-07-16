# 65 — Citation failure analysis

Baseline: Prompt 19.3, frozen test. All 9 failures were classified before V2 evaluation. Evidence: `artifacts/prompt19_4_citation_failures.jsonl`.

| Class | Count |
|---|---:|
| IDENTIFIER_MATCH_UNDERWEIGHTED | 2 |
| AUTHORITY_ORDERING_FAILURE | 1 |
| CORRECT_DOCUMENT_WRONG_CHUNK | 1 |
| GENERAL_RULE_BEATS_SPECIFIC_RULE | 1 |
| STATUS_MISMATCH | 1 |
| TITLE_MATCH_UNDERWEIGHTED | 1 |
| WRONG_DOCUMENT | 1 |
| WRONG_DOCUMENT_VERSION | 1 |

Primary cause: trusted provision/version/source metadata is absent, so semantic similarity is forced to decide exact legal citations. No gold uncertainty was re-labelled.
