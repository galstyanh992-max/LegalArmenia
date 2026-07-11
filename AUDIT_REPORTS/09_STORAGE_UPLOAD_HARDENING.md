# 09 — STORAGE UPLOAD AND PRIVATE FILE ISOLATION

Prompt 08/20 — Wave 2 — Storage Security Implementer
Date: 2026-07-11
Branch: `claude/case-upload-function-fix-lbn2sp`

## DECISION: `STORAGE_CODE_READY_FOR_BEHAVIORAL_TEST`

---

## 1. Bucket and path inventory

| Bucket | Writers | Readers | URL mode |
| --- | --- | --- | --- |
| `case-files` (private) | `caseFileUpload.ts` (case docs), `CasePdfUpload.tsx` (OCR), `CaseForm.tsx` (autofill temp), `useComplaintFiles.ts` (complaint temp), `AudioTranscriptions.tsx` (standalone audio) | same + `BulkOcrButton`, `VolumeManager`, `useAudioTranscriptions`, `useCaseFiles` | **signed URLs only** (300–3600 s) |
| `telegram-uploads` | `telegram-webhook` edge fn (service role) | `TelegramUploads.tsx` (signed URL) | signed only |

`getPublicUrl` — **zero occurrences** in `src/` and `supabase/functions/`. Service-role keys appear only in edge functions, never in browser code (static grep: 0 hits in `src/`).

Canonical private path shapes (deterministic, generated names):

```text
<case_id>/<uuid>.<ext>                  case documents
<user_id>/autofill/<ts>_<sanitized>     temporary autofill
<user_id>/complaints/<ts>-<rand>.<ext>  temporary complaints
<user_id>/standalone/<uuid>.<ext>       standalone audio
```

## 2. Findings and fixes (one boundary per repair cycle)

### S-1 (CONFIRMED, HIGH-availability / key-integrity) — complaint upload used a raw user-controlled extension
`useComplaintFiles.ts` built the key with `file.name.split('.').pop()` — non-ASCII/space extensions produce Storage `InvalidKey` 400s (the exact failure class observed live for autofill in old production code).
**Fix:** new `sanitizeStorageExtension()` (ASCII `[a-z0-9]{1,10}`, fallback `bin`) + `buildComplaintStoragePath()` in `src/lib/uploadPolicies.ts`; hook now uses the builder. Traversal fragments cannot survive (test-verified).

### S-2 (CONFIRMED, MEDIUM) — standalone audio extension taken from filename while MIME gate can pass via `file.type`
`AudioTranscriptions.tsx` accepted a file whose *type* is valid audio but whose filename extension is arbitrary → invalid key.
**Fix:** extension now derived from the normalized MIME via new `AUDIO_EXT_BY_MIME` map — the filename no longer influences the key.

### S-3 (CONFIRMED, CRITICAL, code-level) — `ocr-process` downloaded arbitrary bucket/path with the service role
The storage-URL branch parsed `bucket`/`path` out of the *user-supplied* `fileUrl` and downloaded with the **service-role** client: any authenticated caller could exfiltrate any object from any bucket (foreign case files, telegram uploads) — a Chain-D bypass.
**Fix:** direct object URLs are now downloaded with the **caller-scoped client** (`sb`, anon key + caller JWT) so storage RLS decides; query strings are stripped from the parsed path.

### S-4 (CONFIRMED, HIGH-functional) — signed URLs mis-parsed by the same branch
`/storage/v1/object/sign/<bucket>/<path>?token=…` matched the generic branch with `bucket='sign'` → guaranteed download failure for the primary CasePdfUpload/BulkOcr flow.
**Fix:** dedicated branch: signed URLs (which carry their own scoped, expiring token) are SSRF-checked via the existing `isAllowedFileUrl` and fetched directly.

## 3. Upload validation status

| Control | Where | Status |
| --- | --- | --- |
| Allowed MIME | central `uploadPolicies.ts` (`getAutofillMime`, `getComplaintMime`, `getAudioTranscriptionMime`, `getPdfOcrMime`) | pre-existing, tested |
| Max size | `*_MAX_BYTES` + `isComplaintSupportedFile` etc.; complaint gate at `useComplaintFiles.ts:124` | pre-existing, tested |
| Normalized filename | generated UUID / sanitized names everywhere after S-1/S-2 | fixed, tested |
| Collision handling | UUID names; case-file versioning via `getNextCaseFileVersion` | pre-existing |
| Membership prerequisite | server-side (storage RLS + `case_files` RLS); client errors surfaced | `UNVERIFIED_DB` behaviorally |
| Metadata failure cleanup | `uploadCaseFileWithMetadata` removes the uploaded object on DB-insert failure | pre-existing, now test-verified |
| Pending/retry/cancel | upload pending states in flows; complaint retry per file; no cancel API in architecture — not invented | as designed |

## 4. Private access

* Public URLs: prohibited and absent (grep-verified).
* Signed URLs: created only via authorized client boundaries (browser client under caller JWT, or edge fn after case-membership check); expiries 300–3600 s. Expiry is **not** claimed as a security boundary by itself.
* Browser never composes foreign object paths: all read paths come from RLS-filtered `case_files`/`audio_files` rows (`storage_path` column), all writes go to generated keys under caller-owned prefixes.

## 5. Local-only policies

Deliverable: `supabase/storage-policies/20260711_case_files_private_access.draft.sql` — full intended end-state (minimum-required access, ownership/case-membership predicates, no anonymous access, no `USING (true)`, legacy `telegram-uploads` isolation). Placed **outside** `supabase/migrations/` so no tooling can apply it implicitly; production already carries the user-prefix subset via `20260710170000_fix_case_files_user_scoped_uploads.sql`. **NOT applied.**

## 6. Behavioral test matrix (for disposable environment)

| Actor | Action | Own case | Foreign case | Expected |
| --- | --- | ---: | ---: | --- |
| Anonymous | read | N/A | N/A | DENY |
| Client | upload/read | Yes | No | ALLOW / DENY |
| Lawyer | upload/read | Member | Non-member | ALLOW / DENY |
| Any auth | write to foreign temp prefix | — | — | DENY |
| Any auth | non-UUID first segment (non-temp) | — | — | DENY, no 22P02 |
| Admin | controlled action | policy-defined | policy-defined | EXPLICIT |
| Service | internal operation | scoped | scoped | EXPLICIT |

Status: **`UNVERIFIED_DB`** (no disposable environment in this session; production not used as a test bed).

## 7. Code-level tests added

* `src/lib/storagePaths.test.ts` (9): ASCII normalization; Armenian/non-ASCII stripped; path-traversal fragments cannot survive; empty/oversized fallback; complaint path shape for hostile filenames; audio MIME→extension map integrity.
* `src/lib/caseFileUpload.test.ts` (3): generated case-scoped key (raw filename never in key); **metadata-insert failure removes the uploaded binary** (no orphans); pre-supplied `storagePath` does not double-upload.
* Pre-existing: `uploadPolicies.test.ts` (invalid MIME, oversize, 10 MB boundary) — still green.

## 8. Local repair loop log

| Cycle | Boundary | Fix | Verification |
| --- | --- | --- | --- |
| 1 | complaint path generation | `buildComplaintStoragePath` + sanitizer | storagePaths tests PASS |
| 2 | audio path generation | ext from `AUDIO_EXT_BY_MIME` | storagePaths tests PASS |
| 3 | ocr-process download authorization | caller-scoped download + signed-URL branch | esbuild syntax PASS; full unit suite PASS; deno check ENV-BLOCKED (esm.sh denied by network policy) |
| 4 | metadata cleanup test harness | jsdom `File.arrayBuffer` polyfill in test factory | caseFileUpload tests 3/3 PASS |

Micro audit each cycle: allowed paths only (`src/lib`, `src/components/complaints`, `src/pages/AudioTranscriptions.tsx`, `supabase/functions/ocr-process`, `supabase/storage-policies/`, tests); no suppressions; authorization narrowed (service-role read removed), never widened; no invented DB objects; production untouched; no secrets in diff.

## 9. Verification

| Gate | Result |
| --- | --- |
| Targeted storage tests | 16/16 PASS |
| Full unit suite | **116/116 PASS** |
| Typecheck | PASS |
| Build | PASS (0 errors) |
| Static policy review (no public URL, no browser service-role, no `USING(true)` in draft) | PASS |
| Edge (deno) tests | ENV-BLOCKED (network policy denies deno.land/esm.sh) |

## Exit criteria

* Private upload paths deterministic — ✔
* Browser cannot form foreign paths — ✔ (and the edge-side service-role read primitive is removed)
* Public URLs absent from private flows — ✔
* Local-only policies prepared, not applied — ✔
* Production storage untouched — ✔
* Behavioral verification explicitly `UNVERIFIED_DB` — ✔

**DECISION: `STORAGE_CODE_READY_FOR_BEHAVIORAL_TEST`**
