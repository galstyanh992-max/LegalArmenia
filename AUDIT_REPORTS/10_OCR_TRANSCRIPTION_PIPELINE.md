# 10 — OCR AND AUDIO TRANSCRIPTION PIPELINE

Prompt 09/20 — Wave 2 → Wave 3 — Document Processing Pipeline Implementer
Date: 2026-07-11
Branch: `claude/case-upload-function-fix-lbn2sp`

## DECISION: `DOCUMENT_PROCESSING_READY`

---

## 1. Entry-point inventory

| Stage | Location |
| --- | --- |
| UI actions | `CasePdfUpload.tsx`, `BulkOcrButton.tsx`, `AudioTranscriptions.tsx`, `CaseTranscriptions.tsx` |
| Hooks | `useAudioTranscriptions.ts` (upload→sign→invoke→persist, client retry), `useCaseFiles.ts` |
| Edge functions | `ocr-process/index.ts`, `audio-transcribe/index.ts` |
| Result tables | `audio_transcriptions` (FK `file_id → case_files`), OCR results returned to client / persisted via case flows |
| Provider adapter | `_shared/gateway-bypass.ts` (multimodal), `_shared/ai-provider.ts` |
| Retry | client-side bounded (`useAudioTranscriptions`: 2 attempts, 3 s backoff) |

## 2. Provider contract (confirmed only)

| Field | audio-transcribe | ocr-process |
| --- | --- | --- |
| Request | `{ audioUrl, fileName, caseId, fileId }` | `{ fileUrl/imageUrl, fileName, caseId, fileId }` |
| Auth | caller JWT via anon client `getUser()` → 401 | same |
| Rate limit | `_shared/rate-limiter.ts` (service client) | same |
| Response | `choices[0].message.content` | provider text |
| Timeout | `gateway-bypass` `timeoutMs: 120000` | provider-dependent = `UNKNOWN` (not asserted) |
| Credentials | `SUPABASE_*`, gateway keys (env, never logged) | same |

Anything not directly observable in source is left `UNKNOWN` and not asserted.

## 3. Job lifecycle (domain state ↔ storage)

The schema has no status enum on `audio_transcriptions`; domain states are mapped to concrete signals rather than invented column values:

| Domain state | Signal |
| --- | --- |
| `queued` / `processing` | client mutation `isPending` (no server job row) |
| `completed` | `audio_transcriptions` row exists for `file_id` |
| `failed_retryable` | edge non-2xx / `Failed to send` → client retries (≤2) |
| `failed_terminal` | retries exhausted → mutation rejects, storage/file rolled back |
| `human_review_required` | `needs_review = true` (confidence `< 0.50` or repetition hallucination) |

No fictional status values were introduced.

## 4. Findings and fixes

### P-09-1 (CONFIRMED, HIGH) — non-idempotent transcription persistence
`audio-transcribe` inserted a new `audio_transcriptions` row on every call; `file_id` has **no** unique constraint (`types.ts`: `isOneToOne:false`) and the client **retries** on transient errors. A lost response after a successful insert produced duplicate transcriptions for one file.
**Fix:** before inserting, the function looks up an existing row for `file_id` (via the **caller-scoped** RLS client) and returns it as an idempotent replay; only a genuine absence inserts. Duplicate-request prevention now holds without a DB migration (a unique index remains the recommended `UNVERIFIED_DB` follow-up).

### P-09-2 (CONFIRMED, MEDIUM — carried from Prompt 08) — service-role read in `ocr-process`
Storage download used the service-role client on a user-supplied path. Fixed there; re-confirmed in this pass (caller-scoped download + dedicated signed-URL branch). Cross-referenced, not re-edited.

### P-09-3 (CLEANUP) — inline analysis not testable
The language/hallucination/confidence logic was inline in the Deno handler (untestable under the network-blocked deno runtime).
**Fix:** extracted to a pure, Deno-global-free `supabase/functions/audio-transcribe/analysis.ts` (`analyzeTranscription`, `detectLanguage`, `longestConsecutiveRepeat`), imported by the handler and unit-tested under vitest. Behavior is byte-for-byte equivalent (same thresholds: review `< 0.50`, hallucination run `≥ 8`). Also removes the previous implicit division on `totalChars` (guarded by an explicit empty-input throw).

## 5. Security and integrity checklist

| Control | Status |
| --- | --- |
| Authenticated actor | ✔ (401 on missing/invalid JWT, both functions) |
| Case/file ownership | server-side RLS on storage + `audio_transcriptions` (caller client); idempotency lookup RLS-scoped | 
| Idempotency | ✔ (P-09-1) |
| Bounded retry | ✔ (client ≤2, no server retry loop) |
| Timeout | ✔ (gateway 120 s) |
| Malformed response handling | ✔ (empty transcription → explicit throw) |
| Redacted errors | ✔ (no raw document/audio content in logs; only counts/ids/flags) |
| Provider/model provenance | ✔ (`recordAiMetric` with `model_used`) |
| Source-file reference | ✔ (`file_id`) |
| Human-review flag | ✔ (`needs_review`) |

## 6. Persistence checks

* Duplicate result prevention — ✔ (P-09-1).
* Partial failure — upload/file rolled back on terminal failure (`rollbackCaseFile`), storage cleaned on standalone paths.
* Retry preserves source identity — same `file_id`/`storagePath` across attempts.
* No raw content logged — verified (logs carry filename, ext, ids, sizes, flags only).
* UI refresh after completion — `invalidateQueries(['audio-transcriptions', caseId])`.

## 7. Tests added

`src/test/edge/audio-analysis.test.ts` (9, importing the real edge module):
language classification (Armenian / Russian / mixed / unknown), longest-run counter, empty-input throw, clean high-confidence path, repetition-hallucination → forced review, and the just-below-threshold negative case.

Edge integration tests (`deno test`) remain ENV-BLOCKED (network policy denies `deno.land`/`esm.sh`); the extracted pure module is the runnable substitute for the analysis logic.

## 8. Local repair loop log

| Cycle | Stage | Fix | Verification |
| --- | --- | --- | --- |
| 1 | persistence idempotency | existing-row lookup before insert | esbuild bundle PASS; full unit suite PASS |
| 2 | testability of analysis | extract pure `analysis.ts`, wire handler | esbuild bundle PASS |
| 3 | mixed-language test fixture (Russian-dominant string mis-set expectation) | corrected fixture to Armenian-dominant + >20% Cyrillic (0.58/0.28) | targeted 9/9 PASS |

Micro audit each cycle: allowed paths only (`supabase/functions/audio-transcribe`, `src/test/edge`); no suppressions; authorization not weakened (idempotency lookup uses caller client); no invented columns/enums; no production provider calls; production untouched; no secrets in diff.

## 9. Prohibited-actions check

No real provider calls; no real client documents; no production secret changes; no unbounded retries; no raw-content logging; OCR/transcription still explicitly gated behind `needs_review` (not treated as legally verified).

## 10. Verification

| Gate | Result |
| --- | --- |
| Targeted pipeline tests | 9/9 PASS |
| Full unit suite | **125/125 PASS** |
| Typecheck | PASS |
| Edge bundles (esbuild, both fns) | PASS |
| Build | PASS (0 errors) |
| `deno test` | ENV-BLOCKED (network policy) |

## Exit criteria

* Pipeline states consistent — ✔
* Idempotency & failure handling covered — ✔
* Provider uncertainty not hidden — ✔ (`UNKNOWN` where unconfirmed)
* Sensitive content not logged — ✔
* Tests/typecheck/build PASS — ✔

**DECISION: `DOCUMENT_PROCESSING_READY`**
