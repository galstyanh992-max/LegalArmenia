# 49 — No-answer calibration

## Method

Calibration used train/dev only and compared logistic calibration, isotonic regression, 0.001 threshold grid, intent-specific thresholds and scope-specific thresholds. The selection rule first requires hallucination ≤0.02 on train and dev, then minimizes false no-answer, then chooses the least complex method.

Selected method: global threshold grid; support threshold: `0.526`. Coarse 0.01 grid independently selects 0.52. Dev has 51 answerable and 5 no-answer cases: hallucination 0, false no-answer 0, Brier score 0.1169.

Independent signals remain separate: retrieval relevance, status eligibility, authority quality, temporal validity, evidence sufficiency, citation support and contradiction state. Raw cross-encoder score is never legal confidence.

## Frozen test

For D, GTE and BGE: no-answer hallucination 0/5; false no-answer 1/51 (0.0196). The test result did not alter the threshold.

Required refusal:

`В подключённом корпусе недостаточно подтверждённой информации для надёжного ответа.`

Artifacts: `prompt19_2_relevance_calibration.json` and `prompt19_2_no_answer_threshold_grid.json`.
