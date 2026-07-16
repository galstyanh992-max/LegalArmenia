# 96 — Metric RPC Index Audit

## Live baseline

- pgvector: `0.8.0`.
- `ivfflat.probes=1`, `ivfflat.iterative_scan=off`, `ivfflat.max_probes=32768`.
- Metric IVFFlat: valid/ready, about 10.1 GiB, 206 scans before V2 diagnostics.
- Qwen IVFFlat: valid/ready and unchanged.
- Chunk FTS GIN: valid/ready, about 1.03 GiB.
- Document metadata FTS GIN: valid/ready, about 20.5 MiB.
- Expression indexes already exist for canonical key, ARLIS ID, clean document number, and citation anchor.

The existing indexes are sufficient once queries are decomposed into index-compatible branches. The V1 OR predicates prevent the expression indexes from being selected together, and rank calculation over all chunk FTS matches dominates even when GIN finds candidates efficiently.

## Decision

- Production indexes added: `0`.
- Production indexes changed/dropped: `0`.
- No concurrent index build, table scan, disk growth, WAL amplification, or cancellation risk was introduced.
- V2 uses the existing IVFFlat, GIN, expression, document-id, chunk-id, and version-id indexes with early candidate bounds.
