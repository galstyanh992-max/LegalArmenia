# 00 — CURRENT CHANGE CHECKPOINT (LegalArmenia RAG idealization loop)

**Date:** 2026-07-21
**Worktree:** `D:\1V\LegalArmenia-rag-ideal`
**Branch:** `codex/rag-ideal-repair`
**Base:** `ad20a27bc32ba40c364fbe39d969285d4d17171b` (origin/main)

## Origin of the changes

The reported local RAG repairs first existed as **uncommitted working-tree
changes** in the stale worktree `D:\1V\LegalArmenia-clean` (branch
`codex/supabase-replay-verification`, HEAD `cf652431`, a strict ancestor of
`origin/main` — behind ~30 commits). They were **not** committed and were
**mixed with unrelated pre-existing files** (`src/index.css`, `.e2e_browser.json`,
`AGENTS.md`, `_b2_status_check.ps1`,
`supabase/migrations/20260716000200_metric_rpc_v3.sql`).

Per the loop rules the stale worktree was **not** discarded/reset/overwritten.
Its working-tree diff is preserved verbatim at
`D:\1V\LegalArmenia-clean\AUDIT_REPORTS\RERANKER\preserved\reranker_working_tree.diff`
(56,858 bytes) plus the three new source files in the same `preserved/` dir.

## Transfer to the dedicated worktree

```
git worktree add -b codex/rag-ideal-repair D:\1V\LegalArmenia-rag-ideal origin/main
```

The intended RAG changes were transferred from the prior transplant worktree
(`D:\1V\la-reranker-main`, `codex/reranker-packaging`, already re-applied onto
`origin/main`) and **file hashes verified (10/10 SHA-256 match)**. Only the 10
intended RAG files were transferred; no `.env`, credentials, model binaries,
caches, or unrelated project changes were included.

## Files transferred (10)

Modified (5): `rag-search.ts`, `rag-types.ts`, `embed-query/index.ts`,
`legal-chat/index.ts`, `vector-search/index.ts` (all under `supabase/functions`).
New (5): `legal-reranker.ts`, `legal-reranker.test.ts`, `semantic-status.ts`,
`semantic-status.test.ts` (under `supabase/functions/_shared`), and
`supabase/migrations/20260720000001_revoke_search_legal_corpus_dual_public.sql`.

## Focused commits on `codex/rag-ideal-repair`

1. `bc30c33` — `reranker: add deterministic armenian legal reranking pipeline`
2. `4969c65` — `fix: validate metric embeddings and expose semantic degradation`
3. `8c3707f` — `security: restrict raw retrieval rpc to service_role`

Tree type-checks and tests are green at HEAD.

## Verification at HEAD

- `deno check` clean on `vector-search`, `legal-chat`, `embed-query`,
  `rag-search`, `legal-reranker`, `semantic-status`.
- `deno test` — **43/43 PASS** (34 reranker + 9 semantic-status).
- Secret scan of `origin/main...HEAD` diff: **CLEAN**.
- Worktree clean after commit.

## Claim verification (Phase 1) — proven by executable code

- `legal-reranker.ts` exists; 34 tests exercise real ranking behavior.
- `vector-search` reranks each bucket **before** final limiting.
- `rag-search` preserves reranked ordering (authority-only re-sort removed;
  `rerank_score` tiebreak).
- `legal-chat` derives `semantic_ok = kbOk && practiceOk` (no hardcoded true);
  keyword-only degradation reported via `warn`.
- `rerank_ok` is not an alias of `semantic_ok` (real rerank metadata).
- `embed-query`: dimension (1024), finite, zero-norm, empty input, max input
  size (8000 chars); single-text (no batch vector).
- Structured reason codes propagate to legal-chat telemetry.
- Constant-time secret comparison already on `origin/main` (`constantTimeEqual`).
- Raw-RPC migration matches the exact live function signature (no overloads).

## Reranker classification (Phase 2)

- DETERMINISTIC_RERANKER_STATUS: ACTIVE (feature-weighted scorer; production
  fallback).
- CROSS_ENCODER_RERANKER_STATUS: NOT_DEPLOYED (hook exists, no CE service
  deployed; 0.7/0.3 blend is a hypothesis, not activated).

## Live validation (Phases 3–11)

Requires production/staging access not present here. A missing credential is not
a product failure; the loop stops for one exact operator action (see
`00_LOOP_STATE.json`).

## No deployment

No migrations applied, no Edge secrets changed, no PRs merged, no V3 promotion,
no backfill. Production Supabase `avmgtsonawtzebvazgcr` and ledger 52 untouched.
`SEARCH_CUTOVER` OFF.