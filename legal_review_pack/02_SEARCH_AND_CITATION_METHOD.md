# Search and Citation Method (for lawyer review)

Generated (UTC): 2026-07-20T15:53:00Z

## Retrieval

A user question is embedded and compared against Metric embeddings of Armenian legal corpus chunks. Candidate passages are retrieved via a retrieval RPC, normalized, and re-ranked by a legal reranker. Identifier queries (e.g. an article number) use a dedicated identifier path.

## Citation

The generated answer is required to cite the retrieved corpus records. Citation anchors include document identity, article/provision identity, source title, source URL or internal source reference where allowed, chunk identity, and effective-date/validity metadata where applicable.

## Injection resistance

Retrieved text is treated as untrusted evidence, not instructions. The system is tested against malicious chunk text, fake system messages, citation-suppression requests, fabrication requests, HTML/Markdown injection, cross-document confusion, poisoned metadata, mismatched article IDs, stale law, and PDF prompt injection. Component-level injection tests pass; live-chain validation is pending.

## No-answer

Meaningless or unsupported questions must not produce fabricated legal claims. The system should return a no-answer when the corpus does not support a claim.

## Note for the reviewer

The reviewer should focus on whether the cited authorities are correct and the claims are supported, not on the embedding/reranker internals. Where the reviewer finds a cited authority is wrong, repealed, or misattributed, that is a blocking legal defect.
