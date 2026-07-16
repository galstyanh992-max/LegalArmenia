# 53 — Legal review protocol

The local blind-review tool is in `services/legal-review`. It serves one reviewer slot per process, stores Reviewer A/B labels separately, rejects model/rank fields, and never exposes another reviewer’s labels.

Prepared batch: 280 queries × 10 candidates = 2,800 pairs; canonical SHA-256 `3ee84bc68a22a57960f7ac9268f49cd38482831b0eb37191f689a6096af19187`. Visible fields are query/scope/text/title/status/effective dates/provision/citation metadata. Route, model, vector/reranker scores and rank are absent.

`measure_review_agreement.py` computes weighted kappa, category and binary-field agreement, then produces a separate adjudication input. It cannot promote the dataset status automatically.
