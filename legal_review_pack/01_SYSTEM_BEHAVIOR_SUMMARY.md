# System Behavior Summary (for lawyer review)

Generated (UTC): 2026-07-20T15:53:00Z

## What the system is

AI Legal Armenia is a web application that answers Armenian legal questions by retrieving passages from a corpus of Armenian legal sources (statutes, codes, case material, ECHR material where included) and generating an answer with citations to the retrieved passages.

## Intended behaviour

- Retrieve relevant legal corpus passages for a user question.
- Generate an answer grounded in the retrieved passages.
- Attach citations identifying the source document, article/provision, and chunk.
- Refuse (no-answer) when the question is meaningless, unsupported, or outside the corpus.

## Boundaries

- The system provides legal information with citations, not regulated legal advice. It must not assert personal legal outcomes for a specific person's case as if from a lawyer.
- Citations must come from retrieved corpus records, not be invented by the model.
- Repealed or stale law must be filtered or flagged by effective-date/validity metadata where available.

## What the reviewer is validating

Whether the citations are accurate and current, whether claims are supported by the cited material, whether no-answer behaviour is correct, and whether the system respects legal-advice boundaries. Technical retrieval quality (Recall/MRR) is an engineering concern documented separately; the lawyer review focuses on legal correctness of cited authorities and claims.
