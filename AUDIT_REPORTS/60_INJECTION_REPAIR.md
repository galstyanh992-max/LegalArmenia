# 60 — Injection repair

The custom service treats candidate text as data, preserves request IDs, rejects untrusted metadata and applies a deterministic penalty to instruction-like boilerplate. Adversarial negatives were included in training.

Service-contract injection controls pass, but frozen corpus-ranking pass rate remains `0.5`: only one of two test injection queries ranks a legally expected source first. The synthetic command cannot force rank 1, yet legal relevance quality remains insufficient. Release gate `1.00` failed.
