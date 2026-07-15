# 73 — Legal review operator guide

1. Lawyer A and Lawyer B receive different blind batch files and different reviewer IDs/tokens.
2. Each runs `services/legal-review/app.py` on localhost with a separate append-only labels file.
3. Verify the displayed/exported batch SHA-256 against `prompt19_3_review/review_batch_manifest.json`.
4. Complete all items independently. Model name, score, route and rank remain hidden. Browser drafts autosave locally; accepted labels are immutable and hash-chained.
5. Export both label sets. Run agreement/conflict generation; neither reviewer sees the other's labels before completion.
6. A third lawyer adjudicates only the conflict queue. Preserve both original records and append adjudication records; never overwrite.
7. Recompute dataset hash and agreement metrics before any release decision.

Current status: Lawyer A 0/1400, Lawyer B 0/1400, adjudicated 0. Legal approval pending; no labels were generated automatically.
