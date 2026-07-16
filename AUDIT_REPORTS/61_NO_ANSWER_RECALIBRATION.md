# 61 — No-answer recalibration

Prompt 19.2 threshold `0.526` was not carried forward automatically. A new 0.001 dev grid plus hard legal rejection selected `0.569`: dev false-answer `0`, false-no-answer `0`.

Frozen test: false-answer `0`; false-no-answer `2/51 = 0.03922`. This is worse than the existing deterministic policy and is rejected. Custom model confidence is never treated as legal validity; no production threshold changes occurred.
