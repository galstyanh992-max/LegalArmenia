# 56 — Armenian tokenization audit

| Encoder | Revision | Armenian tokens/word | Truncation @128 | Legal-term split | License |
|---|---|---:|---:|---:|---|
| XLM-R base | `e73636d4f797dec63c3081bb6ed5c7b0bb3f2089` | 2.5593 | 0.9767 | 0.10 | MIT |
| Distil-mBERT | `45c032ab32cc946ad88a166f7cb282f58c753c2e` | 4.1740 | 0.9900 | 0.60 | Apache-2.0 |
| mBERT | `3f076fdb1ab68d5b2880cb87a0886f315b8146f8` | 4.1740 | 0.9900 | 0.60 | Apache-2.0 |

All preserved article numbers in the audited round-trip sample. Full-chunk truncation is severe for every candidate, requiring provision-aware truncation/cascades. Distil-mBERT was selected for the full engineering run because its pilot batch latency was about half the other encoders; tokenization quality was not declared ideal.
