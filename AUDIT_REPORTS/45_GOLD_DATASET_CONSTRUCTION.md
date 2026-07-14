# 45 — Gold dataset construction

## Status

`ENGINEERING_GOLD_PENDING_LEGAL_REVIEW`

The frozen set contains 280 cases from a read-only snapshot of production corpus identifiers. No production write was performed. Two independent legally competent reviewers, disagreement adjudication, and inter-rater agreement remain pending; the dataset is not release-eligible.

## Frozen inputs

- Corpus rows/chunks: 592/592; documents: 564.
- Corpus SHA-256: `27bfa2ba968e6eec84cbf94528246e62c12e8be3be9338cfa2469eb5c71fd251`.
- Dataset SHA-256: `9d324b10918a66bad74ed468faeec027952858235f5df433ca5702488c2a0381`.
- Candidate-pool SHA-256: `dca97f24244bd2ace3155d83b8db678f12c5ac13b8982b86044138674db373b7`.
- Blinded-pool SHA-256: `0bc062e8384e6de7037d365fe3df81bdf8d6f09c77306e1a662e23e3b4897cd6`.
- Candidate pool: 50 unique chunks per query.
- Split by document/query family: train 168, dev 56, test 56; detected family leakage: 0.

## Composition

| Intent | Cases |
|---|---:|
| Armenian semantic | 100 |
| Exact law/article/part/point | 30 |
| Russian → Armenian | 25 |
| Case/name/date | 20 |
| Historical law | 20 |
| Active vs repealed | 20 |
| Unknown-status discovery | 20 |
| No-answer | 25 |
| Prompt injection | 10 |
| Duplicate/near-duplicate | 10 |

## Controls and limitations

Corpus text was redacted for email, phone-like and secret-like strings; identifiers were not redacted. Auth, tenant, private-user data, vectors and secrets were excluded. An early snapshot build incorrectly redacted UUID-like numbers and created duplicate IDs; all derived artifacts from that attempt were deleted and rebuilt before the final freeze. The final validator passes 24/24 checks.

Labels are engineering provenance labels, not lawyer approval. Test was not used to train feature weights, select calibration, or select model blend weights.

## Artifacts

`prompt19_2_frozen_gold.jsonl`, `prompt19_2_gold_{train,dev,test}.jsonl`, `prompt19_2_candidate_pools.jsonl`, `prompt19_2_blinded_candidate_pools.jsonl`, `prompt19_2_raw_judgments.jsonl`, `prompt19_2_adjudication_log.json`, and `prompt19_2_artifact_validation.json`.
