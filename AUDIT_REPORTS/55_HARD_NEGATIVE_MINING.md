# 55 — Hard-negative mining

Engineering expansion: 2,716 unique queries (2,016 train / 700 dev), derived only from non-test Prompt 19.2 parents. Frozen test remains 56 unchanged cases. Dataset SHA-256: `599be689c6eacc0652232334bbb48f903e10ad9db5f759da756f65c565d01b35`.

1,130 negatives were mined from Metric ANN, Armenian FTS, identifier and frozen status strata plus separate adversarial fixtures: 193 semantic, 194 lexical, 330 status, 24 wrong-identifier, 2 near-duplicate/wrong-provision, 193 easy and 194 adversarial. SHA-256: `9af5692f2739daa20dd3e0d460a470812a70db0edc2c770b3896b49fbcb57b2e`.

All expansion labels are explicitly weak engineering supervision pending legal review. Thirty duplicate/test-colliding parent queries were excluded. Leakage detector passes with zero frozen-test chunk or document-family overlap.
