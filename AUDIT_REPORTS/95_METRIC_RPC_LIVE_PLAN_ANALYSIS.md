# 95 — Metric RPC Live Plan Analysis

Project: `avmgtsonawtzebvazgcr`. All probes were read-only, bounded by local statement/lock timeouts, and emitted no query text, vectors, chunk text, or IDs.

## Dominant cause

V1 executes OR-heavy identifier predicates and `lower(btrim(search_chunks.text))` before an effective candidate bound. The chunk identifier lane could not complete within a dedicated 5-second probe. Its plan scans the primary-key order across an estimated 669,644 active Armenian rows and evaluates the OR filter row-by-row.

The identifier document lane also scans all 218,299 documents because multiple expressions are joined by OR. It took 2,724 ms, removed 218,299 rows, and consumed 220,121 shared-hit blocks.

## Lane breakdown

| Lane | Result | Evidence |
| --- | ---: | --- |
| Identifier documents | 2,724 ms | 218,299 scanned; 220,121 shared hits; no match |
| Identifier chunks | >5,000 ms | bounded probe cancelled; PK scan plus OR/full-text equality |
| Chunk FTS | 4,698 ms | GIN used; 16,162 ranked; 71,170 shared hits; 13,271 reads |
| Document metadata FTS | 3.6 ms | `documents_metric_search_fts_idx` used; 2 rows |
| Fusion, 60 bounded candidates | 0.6 ms | no temp I/O; in-memory top-N |
| ANN probes 5 | 886 ms | `embeddings_ivf_metric_idx`; no sequential scan |
| ANN probes 10 | 815 ms | `embeddings_ivf_metric_idx`; no sequential scan |
| ANN probes 20 | 1,564 ms | index used |
| ANN probes 30 | 3,154 ms | index used |
| ANN early 500 then eligibility | 2,270 ms | IVFFlat + PK joins; no sequential scan |

Conclusion: the 60-second V1 timeout was a cumulative unbounded-lane problem led by the chunk identifier scan and expensive full candidate ranking in chunk FTS. Fusion was not the bottleneck.
