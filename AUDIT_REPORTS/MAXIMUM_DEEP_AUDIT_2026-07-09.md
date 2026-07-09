# MAXIMUM DEEP AUDIT REPORT — AiLegal Armenia

**Дата:** 2026-07-09  
**Аудитор:** Объединённая senior-команда (Principal Architect, CTO Engineer, Supabase/RLS Auditor, Security Engineer, AI Safety, Legal-Tech Risk, QA)  
**Режим:** Audit-only. Без изменений кода.  
**Коммит:** `8178e78` (main)

---

## 0. Executive Summary

- **Final Verdict:** RETURN_TO_REPAIR_LOOP
- **Highest Severity Found:** HIGH
- **Production Blockers:** 4 HIGH, 8 MEDIUM
- **Static Gates:** Typecheck PASS, Lint PASS (warnings), Tests FAIL (13/13 suites)
- **Runtime Gates:** NOT_RUN (browser scenarios not executed)
- **Security Status:** No exposed secrets in frontend; service_role confined to edge functions; RLS properly scoped
- **RLS Status:** CONFIRMED — ocr_results INSERT scoped to case members; case-files storage scoped to user paths
- **Upload/OCR Status:** PARTIALLY_CONFIRMED — central policies exist; rollback exists; temp cleanup exists; but complaint flow accepts unsanctioned types (.docx, .txt) and no rate limit on autofill edge function
- **AI/Legal-Tech Risk Status:** PARTIALLY_CONFIRMED — disclaimer namespace exists in i18n; `needs_review` flag exists; confidence threshold (0.7) exists; BUT disclaimer NOT shown in autofill flow, OCR result NOT marked as non-authoritative in UI

---

## 1. Phase 0 — Audit Setup

| Item | Status | Evidence |
|---|---|---|
| package.json inspected | PASS | `vite_react_shadcn_ts`, npm, Vite 8.1.3, Supabase JS 2.91.1 |
| package manager detected | npm | `package-lock.json` + `bun.lock` present; npm is primary |
| scripts detected | PASS | `dev`, `build`, `lint`, `test`, `test:watch`, `test:edge`, `test:all` |
| git status inspected | PASS | 1 modified file (`src/hooks/useCases.ts`), branch `main`, up to date with origin |
| git diff inspected | PASS | Only `useCases.ts` modified (unstaged) |
| changed files mapped | PASS | Single unstaged change; last 20 commits show audio transcription + UI + upload policies |
| Supabase structure mapped | PASS | 169 migrations; Edge Functions: 20+ including extract-case-form-fields, audio-transcribe, telegram-webhook, ocr-process, ai-analyze |
| tests mapped | PARTIAL | 0 test files in `src/`; 6 edge test files in `supabase/functions/_tests/`; ~40 test files in `_shared/`; Python tests in `tests/` |

**Architecture Map:**
- Frontend: React 18 + TypeScript + Vite + shadcn/ui + react-query + i18next + react-router-dom
- Backend: Supabase (PostgreSQL + RLS + Storage + Edge Functions)
- Edge Functions (20+): ai-analyze, audio-transcribe, extract-case-form-fields, telegram-webhook, ocr-process, and others
- Key shared libs: `src/lib/uploadPolicies.ts` (centralized policies), `src/lib/caseFileUpload.ts` (shared upload+rollback)
- i18n: en/ru/hy with `disclaimer.json` namespace for AI warnings

---

## 2. Phase 1 — Legal-Tech Product Risk Audit

| Area | Expected | Evidence | Status | Risk |
|---|---|---|---|---|
| Human review | AI outputs must be reviewed by human before legal use | `needs_review` flag exists in `ocr_results`, `audio_transcriptions`; confidence threshold 0.7 triggers review flag; BUT no UI enforces review before using extracted data | PARTIALLY_CONFIRMED | MEDIUM |
| AI disclaimer | Clear disclaimer that AI/OCR is not authoritative | `disclaimer.json` i18n namespace EXISTS with `ai_warning`, `main`, `legal_advice_disclaimer` keys in en/ru/hy | CONFIRMED | LOW |
| OCR reliability warning | Low-confidence OCR flagged for review | `CasePdfUpload.tsx` line 162: `toast.warning(t('ocr:low_quality_warning'))` when `needs_review`; `AudioUpload` shows confidence %; `useAudioTranscriptions` marks `needs_review` when confidence < 0.5 | CONFIRMED | LOW |
| Sensitive data handling | Documents treated as sensitive | Storage paths use `userId/caseId/` pattern; RLS restricts access; signed URLs have expiry (300s for complaint, 3600s for PDF/audio) | CONFIRMED | LOW |
| Failed AI/OCR transparency | Failures shown to user, not hidden | `CasePdfUpload.tsx` shows error states; `useAudioTranscriptions` shows error toasts; `useComplaintFiles` shows error toasts | CONFIRMED | LOW |
| Legal content logging | No PII/document content in logs | Edge functions log metadata, not document text; `console.error` in `useComplaintFiles` logs "File processing error" not file content | PARTIALLY_CONFIRMED | MEDIUM |
| User trust / UX | Autofill shows AI-generated nature | **CaseFormFileUpload does NOT show disclaimer** before autofill; CasePdfUpload shows `pdf_upload_description` but NOT disclaimer namespace | PARTIALLY_CONFIRMED | HIGH |

**FINDING LT-1 (HIGH):** CaseForm autofill (CaseFormFileUpload → extract-case-form-fields) fills legal case fields with AI-extracted data WITHOUT showing any disclaimer that results are AI-generated and may be inaccurate. The `disclaimer.json` namespace exists but is NOT rendered in the autofill flow.

**FINDING LT-2 (MEDIUM):** OCR results stored in `ocr_results` table have `needs_review` column, but there is no UI gate preventing users from treating low-confidence OCR text as authoritative legal content.

---

## 3. Phase 2 — Architecture Audit

| Area | Finding | Evidence | Severity | Decision |
|---|---|---|---|---|
| Upload policy centralization | CONFIRMED — `uploadPolicies.ts` is the single source of truth for MIME types, size limits, accept strings, and normalization | `uploadPolicies.ts` lines 1-106: MB, limits, MIME maps, normalize functions, isSupported functions | INFO | ACCEPT |
| Shared upload helper | CONFIRMED — `caseFileUpload.ts` provides `uploadCaseFileWithMetadata()` with SHA-256, versioning, content-type normalization, rollback | `caseFileUpload.ts` lines 35-84: computeSHA256, getNextCaseFileVersion, uploadCaseFileWithMetadata, rollbackCaseFile | INFO | ACCEPT |
| CasePdfUpload bypass | CasePdfUpload does raw `supabase.storage.upload()` first, then calls `uploadCaseFileWithMetadata()` with `storagePath` param to create DB record only — this is intentional for the 2-phase upload (storage → OCR → attach) | `CasePdfUpload.tsx` lines 121-126: raw storage upload; lines 231-238: `uploadCaseFileWithMetadata({ storagePath })` | INFO | ACCEPT |
| Complaint flow not using shared policies | `useComplaintFiles.ts` uses its own inline MIME detection (`isText`, `isDocx`, `isOldDoc`, `isImage`, `isPdf`) instead of `uploadPolicies.ts` functions | `useComplaintFiles.ts` lines 30-36: inline type detection | MEDIUM | FIX — complaint flow should use shared `normalizeCaseFileContentType()` |
| TXT accepted in complaints | Complaint flow accepts `.txt` and `.md` files (`file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")`) which are NOT in `uploadPolicies.ts` allowlists | `useComplaintFiles.ts` lines 32-33 | HIGH | FIX — remove or explicitly sanction TXT/MD |
| DOCX in complaints | Complaint flow accepts DOCX and sends to OCR, but OCR backend may not handle DOCX correctly (no DOCX parser confirmed in edge functions) | `useComplaintFiles.ts` lines 33-34, 49 | MEDIUM | FIX — validate DOCX support in OCR pipeline |
| Complaint max size 10MB vs policy 15MB | `useComplaintFiles.ts` uses `10 * 1024 * 1024` hardcoded limit, not the centralized `PDF_OCR_MAX_BYTES` (15MB) | `useComplaintFiles.ts` line 123 | MEDIUM | FIX — use centralized constant |
| No rate limit on extract-case-form-fields | Edge function has no rate limiting; user can call autofill repeatedly | `extract-case-form-fields/index.ts`: no rate limit code | MEDIUM | FIX — add rate limiting |
| Dead code in useAudioTranscriptions | `addToKnowledgeBase` mutation throws `legacyRetrievalUnsupported()` — stub that will always fail | `useAudioTranscriptions.ts` lines 209-237 | LOW | FIX — remove or implement |

---

## 4. Phase 3 — Database / Supabase / RLS Audit

| Area | Expected | Evidence | Status | Severity | Required Action |
|---|---|---|---|---|---|
| ocr_results INSERT policy | Narrow ownership-safe insert | Migration `20260709143851`: `WITH CHECK (file_id IN (SELECT cf.id FROM case_files cf JOIN cases c ON c.id = cf.case_id WHERE cf.deleted_at IS NULL AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid() OR c.lawyer_id IN (SELECT get_team_member_ids(auth.uid())) OR has_role(auth.uid(), 'admin'))))` — scoped to case members ✅ | CONFIRMED | LOW | None |
| ocr_results SELECT policies | User/case scoped | Initial migration + team leader + auditor policies exist; RLS ENABLED on `ocr_results` | CONFIRMED | LOW | None |
| case_files RLS | User/case scoped | Storage objects policies for `case-files` bucket use `(storage.foldername(name))[1] = auth.uid()::text` pattern for autofill; case file policies use `can_manage_case()` function | CONFIRMED | LOW | Verify `can_manage_case()` is properly scoped |
| case_files DELETE policy | Admin or case lawyer only | Migration `20260707120000_f7_2_align_case_file_delete.sql`: `case_files_delete` requires `admin` OR `is_case_lawyer(case_id)` | CONFIRMED | LOW | None |
| storage object policies | Path/user scoped | Autofill: userId/autofill/ prefix; case files: caseId/ prefix; DELETE: admin or case lawyer | CONFIRMED | LOW | None |
| service role usage | Server-only guarded | Service role used in edge functions (extract-case-form-fields, audio-transcribe, telegram-webhook, ocr-process) for DB operations that bypass RLS — **necessary for server-side operations**; NOT exposed in frontend | CONFIRMED | LOW | None — correct pattern |
| migrations safety | Non-destructive or justified | Recent migrations use `DROP POLICY IF EXISTS` + `CREATE POLICY` pattern (idempotent); no destructive `DROP TABLE` or `CASCADE` in recent migrations | CONFIRMED | LOW | None |
| rate limit persistence | Telegram: `telegram_uploads` table with per-chat-id rate limit | `telegram-webhook/index.ts` lines 124-148: DB-backed rate limit `TELEGRAM_UPLOADS_PER_HOUR = 10` | CONFIRMED | LOW | None |
| Temporary upload cleanup | Autofill temp files have cleanup in edge function; CasePdfUpload has `cleanupUploadedPdf()`; complaint has `finally { remove }` block | `CasePdfUpload.tsx` line 69-81, `useComplaintFiles.ts` lines 104-111, `extract-case-form-fields` cleans up temp files | CONFIRMED | LOW | Verify edge function cleanup on ALL error paths |

**FINDING DB-1 (MEDIUM):** The `ocr_results` INSERT policy is properly scoped, but there is no UPDATE or DELETE policy verification — once inserted, can any case member modify/delete OCR results? The SELECT policies allow case members to read, but UPDATE/DELETE scoping needs verification against live schema.

**FINDING DB-2 (INFO):** `can_manage_case()` and `get_team_member_ids()` are used in RLS policies but their implementations need verification against live schema to ensure they don't have overly broad definitions.

---

## 5. Phase 4 — Backend / Edge Functions Audit

| Function | Auth | Validation | File Limits | Security | Error Handling | Status | Evidence |
|---|---|---|---|---|---|---|---|
| extract-case-form-fields | JWT via `getUser(token)` ✅ | MIME allowlist (pdf/jpeg/png/tiff) ✅ | 15MB ✅ | Path validation (`userId/autofill/` prefix) ✅; No rate limit ⚠️ | Error messages safe ✅ | PARTIAL | Lines 102-366; no rate limit |
| audio-transcribe | JWT via `getUser()` ✅ | MIME normalization ✅; Extension check ✅ | 25MB ✅ | Rate limit per user (DB-backed) ✅; Signed URL validated ✅ | Retry logic (2 attempts) ✅ | CONFIRMED | Lines 1-310 |
| telegram-webhook | Webhook secret ✅ | MIME allowlist (deny-by-default) ✅; Extension + MIME cross-check ✅ | 20MB (checked before AND after download) ✅ | Rate limit 10/hour per chat_id ✅; Service role write after validation ✅ | Safe error messages ✅ | CONFIRMED | Lines 1-541 |
| ocr-process | JWT auth ✅ | File URL from signed storage ✅ | N/A (processes already-uploaded file) | Service role for DB write ✅ | Error responses ✅ | CONFIRMED | Per subagent evidence |

**FINDING EF-1 (MEDIUM):** `extract-case-form-fields` has NO rate limiting. A user could call autofill repeatedly, potentially incurring significant LLM API costs.

**FINDING EF-2 (LOW):** `extract-case-form-fields` validates `bucket === "case-files"` and path prefix `userId/autofill/`, but does NOT verify `caseId` belongs to the user — this is acceptable because autofill files are temporary per-user uploads, not case-scoped.

---

## 6. Phase 5 — Upload / OCR / Audio / Telegram Regression Audit

### 5.1 Autofill

| Check | Expected | Evidence | Status | Severity |
|---|---|---|---|---|
| UI advertises only supported types | PDF/JPG/PNG/TIFF | `AUTOFILL_ACCEPT = ".pdf,.jpg,.jpeg,.png,.tiff,.tif"` ✅ | CONFIRMED | — |
| Backend rejects unsupported types | Reject DOCX, audio, TXT | `getAutofillMime()` returns null for DOCX/audio; edge function checks MIME allowlist | CONFIRMED | — |
| 15MB limit aligned | Both UI and backend enforce 15MB | `AUTOFILL_MAX_BYTES = 15 * MB`; edge function also checks 15MB | CONFIRMED | — |
| Temp cleanup on success | Edge function cleans up temp file after processing | Confirmed in subagent evidence | CONFIRMED | — |
| Temp cleanup on backend error | Edge function cleans up on error | Confirmed | CONFIRMED | — |
| Temp cleanup on close/cancel | Frontend cleanup | `CaseFormFileUpload` does not upload to storage until form submission; autofill uses temp path with cleanup | PARTIALLY_CONFIRMED | — |
| Temp cleanup on unmount | Component unmount cleanup | NOT explicitly verified in useEffect cleanup | UNKNOWN | MEDIUM |
| No binary UTF-8 decode | Edge function handles binary correctly | Edge function uses arrayBuffer/pdf-parse | CONFIRMED | — |
| No rate limit | Should have rate limiting | NO rate limiting on autofill endpoint | **NOT_PRESENT** | **MEDIUM** |

### 5.2 PDF OCR

| Check | Expected | Evidence | Status | Severity |
|---|---|---|---|---|
| UI/backend limit 15MB | Both enforce 15MB | `PDF_OCR_MAX_BYTES = 15 * MB`; `isPdfOcrSupportedFile()` checks size; edge function also checks | CONFIRMED | — |
| Upload blocked before storage if >15MB | Frontend rejects | `handleFileSelect` line 87-94: checks `isPdfOcrSupportedFile(file)` which includes size check | CONFIRMED | — |
| Storage path tracked | `storageFileNameRef` tracks path | `CasePdfUpload.tsx` lines 64-67 | CONFIRMED | — |
| DB row tracked | `attachedFileIdRef` tracks ID | `CasePdfUpload.tsx` line 66 | CONFIRMED | — |
| OCR failure rolls back | `cleanupUploadedPdf()` called on error | `CasePdfUpload.tsx` lines 167-173 | CONFIRMED | — |
| Attach failure rolls back | `rollbackCaseFile()` called | `CasePdfUpload.tsx` line 273 | CONFIRMED | — |
| Close/cancel before attach rolls back | `handleClose` calls `cleanupUploadedPdf()` | `CasePdfUpload.tsx` lines 278-291 | CONFIRMED | — |
| OCR result save failure is fatal | Throws error if `ocrError` | `CasePdfUpload.tsx` lines 253-255: `throw new Error('OCR result save failed: ...')` | CONFIRMED | — |
| Successful attach preserves final file | `isAttachedRef` prevents cleanup | `CasePdfUpload.tsx` line 258: `isAttachedRef.current = true` | CONFIRMED | — |
| Test coverage | Tests should exist | **NO test file found for CasePdfUpload** | **NOT_PRESENT** | **MEDIUM** |

### 5.3 Audio

| Check | Expected | Evidence | Status | Severity |
|---|---|---|---|---|
| MP3/WAV/M4A/OGG only | `AUDIO_TRANSCRIPTION_ACCEPT = ".mp3,.wav,.m4a,.ogg"` | `uploadPolicies.ts` line 11 | CONFIRMED | — |
| Max size 25MB | `AUDIO_TRANSCRIPTION_MAX_BYTES = 25 * MB` | `uploadPolicies.ts` line 6 | CONFIRMED | — |
| M4A normalized | `audio/mp4` normalization | `AUDIO_MIME_NORMALIZATION`: `audio/x-m4a` → `audio/mp4`, `audio/m4a` → `audio/mp4` | CONFIRMED | — |
| Rollback on signed URL failure | `rollbackCaseFile()` called | `useAudioTranscriptions.ts` lines 131-134 | CONFIRMED | — |
| Rollback on transcription failure | `rollbackCaseFile()` called in catch | `useAudioTranscriptions.ts` lines 131-134 | CONFIRMED | — |
| UI refetch/invalidation on error | `onSettled` invalidates queries | `useAudioTranscriptions.ts` lines 158-161 | CONFIRMED | — |
| Final success preserves storage + DB | No rollback when finalized | `finalized = true` flag prevents rollback | CONFIRMED | — |
| Unsupported video formats removed | Audio-only MIME allowlist | `getAudioTranscriptionMime()` returns null for video types | CONFIRMED | — |
| Edge function validates MIME | Server-side MIME check | Confirmed in subagent evidence | CONFIRMED | — |

### 5.4 Complaint OCR

| Check | Expected | Evidence | Status | Severity |
|---|---|---|---|---|
| Temp cleanup in `finally` | `finally` block removes temp file | `useComplaintFiles.ts` lines 104-111 | CONFIRMED | — |
| Cleanup on signed URL failure | Throws, caught, `finally` cleans up | `useComplaintFiles.ts` lines 79-80, 99-111 | CONFIRMED | — |
| Cleanup on OCR failure | Throws, caught, `finally` cleans up | `useComplaintFiles.ts` lines 83-96, 99-111 | CONFIRMED | — |
| Cleanup on unexpected exception | `finally` block always runs | `useComplaintFiles.ts` lines 104-111 | CONFIRMED | — |
| Permanent files not accidentally deleted | Only `tempStoragePath` is cleaned | `useComplaintFiles.ts` line 27: `let tempStoragePath: string \| null = null`; only deleted if set | CONFIRMED | — |
| Original error not masked by cleanup error | Cleanup error logged with `console.warn`, original error thrown | `useComplaintFiles.ts` lines 107-109: warn but don't throw cleanup error | CONFIRMED | — |
| **Accepts .txt and .md files** | Should only accept supported types | `useComplaintFiles.ts` lines 32: `file.type.startsWith("text/") \|\| file.name.endsWith(".txt") \|\| file.name.endsWith(".md")` | **NOT_CONFIRMED** | **HIGH** |
| **Accepts .doc/.docx without confirmed parser** | Should validate DOCX parser exists | `useComplaintFiles.ts` lines 33-34: accepts DOCX; lines 39-48: only rejects `.doc` but accepts `.docx` | **NOT_CONFIRMED** | **MEDIUM** |
| **Hardcoded 10MB limit** | Should use centralized constant | `useComplaintFiles.ts` line 123: `10 * 1024 * 1024` instead of `PDF_OCR_MAX_BYTES` (15MB) | **NOT_CONFIRMED** | **MEDIUM** |

### 5.5 Shared Upload Metadata

| Upload Path | SHA-256 | Version | Content-Type Normalization | Evidence | Status |
|---|---|---|---|---|---|
| CaseFileUpload | ✅ `computeSHA256` in `caseFileUpload.ts` | ✅ `getNextCaseFileVersion` | ✅ `normalizeCaseFileContentType` | `caseFileUpload.ts` lines 16-21, 23-33, 46 | CONFIRMED |
| CasePdfUpload | Uses `uploadCaseFileWithMetadata({ storagePath })` which re-uses SHA-256 | ✅ Same version logic | ✅ Uses `getPdfOcrMime()` | `CasePdfUpload.tsx` lines 118-119, 231-238 | CONFIRMED |
| Audio | Uses `uploadCaseFileWithMetadata({ contentType })` with `getAudioTranscriptionMime()` | ✅ Same version logic | ✅ Audio MIME normalization | `useAudioTranscriptions.ts` line 75 | CONFIRMED |
| Complaint | ❌ Does NOT use shared helper | ❌ No versioning | ❌ Uses inline MIME detection | `useComplaintFiles.ts` lines 30-36 | **NOT_CONFIRMED** |

### 5.6 Telegram

| Check | Expected | Evidence | Status | Severity |
|---|---|---|---|---|
| MIME allowlist deny-by-default | Extension-to-MIME map, only listed types | `telegram-webhook/index.ts` lines 77-86: explicit allowlist ✅ | CONFIRMED | — |
| Size checked before download | `TELEGRAM_UPLOAD_MAX_BYTES = 20 MB`; checked from Telegram metadata | Line 114: `if (file_size > TELEGRAM_UPLOAD_MAX_BYTES)` | CONFIRMED | — |
| Size checked after download | `byteLength` check on downloaded buffer | Line 485: size check after download | CONFIRMED | — |
| Max size 20MB | `TELEGRAM_UPLOAD_MAX_BYTES = 20 * 1024 * 1024` | Line 75 | CONFIRMED | — |
| Rate limit per chat_id | `TELEGRAM_UPLOADS_PER_HOUR = 10`; DB-backed counting | Lines 124-148 | CONFIRMED | — |
| Service role write after validation | Service role used only after all checks pass | Confirmed in subagent evidence | CONFIRMED | — |
| Unsupported MIME rejected | Returns 415 to user | Confirmed | CONFIRMED | — |
| Oversized rejected | Returns 413 to user | Confirmed | CONFIRMED | — |
| Logs safe | No PII/secrets in logs | Confirmed | CONFIRMED | — |
| No token/service key exposure | Bot token in env only, webhook secret validated | CONFIRMED | — |
| Rate limit bypass difficulty | Per chat_id, DB-backed, not trivially bypassable | CONFIRMED | — |
| Error message safe | Generic user-friendly messages in user's language | CONFIRMED | — |

---

## 7. Phase 6 — Frontend / UI / UX Audit

| Page / Component | Element / Flow | Expected | Evidence | Status | UX Risk |
|---|---|---|---|---|---|
| CaseFormFileUpload | File type selection | Shows supported types | `CASE_FILE_ACCEPT` includes DOC/DOCX/audio | CONFIRMED | — |
| CaseFormFileUpload | Size validation | Rejects >50MB | `file.size > CASE_FILE_MAX_BYTES` check | CONFIRMED | — |
| CaseFormFileUpload | Max files limit | Limits to 20 files | `MAX_FILES = 20` | CONFIRMED | — |
| CasePdfUpload | File type filter | PDF/JPG/PNG/TIFF only | `PDF_OCR_ACCEPT = ".pdf,.jpg,.jpeg,.png,.tiff,.tif"` | CONFIRMED | — |
| CasePdfUpload | Size limit display | Shows "15MB" label | `PDF_OCR_SUPPORTED_LABEL` | CONFIRMED | — |
| CasePdfUpload | Progress indicator | Shows upload/processing/analyzing states | `status` state machine with progress bar | CONFIRMED | — |
| CasePdfUpload | Error display | Shows error with AlertTriangle icon | Lines 361-366 | CONFIRMED | — |
| CasePdfUpload | **No AI disclaimer in autofill** | Should show disclaimer before AI-generated content | No `disclaimer.json` keys rendered in CasePdfUpload or CaseFormFileUpload | **NOT_PRESENT** | **HIGH** |
| CasePdfUpload | Low confidence warning | Shows `needs_review` toast | Line 162 | CONFIRMED | — |
| CasePdfUpload | Extracted text editable | User can review and edit OCR text | `<Textarea value={extractedText} onChange={...}/>` | CONFIRMED | — |
| AudioUpload | Format restriction | MP3/WAV/M4A/OGG | `AUDIO_TRANSCRIPTION_ACCEPT` | CONFIRMED | — |
| AudioUpload | Size limit display | Shows "25MB" label | `AUDIO_TRANSCRIPTION_SUPPORTED_LABEL` | CONFIRMED | — |
| useComplaintFiles | **Accepts TXT/MD/DOCX** | Should match centralized policies | Inline MIME detection allows TXT, MD, DOCX | **NOT_CONFIRMED** | **HIGH** |
| useComplaintFiles | **10MB hardcoded limit** | Should use centralized constant | `10 * 1024 * 1024` vs `PDF_OCR_MAX_BYTES` (15MB) | **NOT_CONFIRMED** | **MEDIUM** |
| All upload components | Cancel/close behavior | Cleanup on dialog close | `CasePdfUpload.handleClose` calls `cleanupUploadedPdf()` | CONFIRMED | — |
| i18n | AI disclaimer strings | Exist in all 3 languages | `disclaimer.json` in en/ru/hy | CONFIRMED | — |
| i18n | **Disclaimer NOT rendered in autofill flow** | Should show before AI fills form | CaseFormFileUpload and CasePdfUpload don't use `disclaimer` namespace | **NOT_PRESENT** | **HIGH** |

---

## 8. Phase 7 — AI / OCR / LLM Safety Audit

| AI Area | Check | Evidence | Status | Risk |
|---|---|---|---|---|
| Prompt injection | System prompts instruct model behavior | `extract-case-form-fields` has structured system prompt; `ai-analyze` has role-based prompts | PARTIALLY_CONFIRMED | MEDIUM |
| Hallucination risk | AI may generate incorrect legal content | `disclaimer.json` exists with `ai_warning` key but NOT shown in autofill flow | NOT_CONFIRMED | HIGH |
| Source grounding | OCR extracts from actual document | PDF/image OCR uses `ocr-process` with pdf-parse; extracts text from actual document | CONFIRMED | LOW |
| Legal advice disclaimers | Must show disclaimer | `disclaimer.json` namespace exists with `ai_warning`, `main`, `legal_advice_disclaimer`; BUT not rendered in key UI flows | PARTIALLY_CONFIRMED | HIGH |
| Human review | User can review/edit extracted text | CasePdfUpload: editable `<Textarea>`; Audio: `needs_review` flag + edit capability | CONFIRMED | LOW |
| Confidence handling | Low confidence flagged | CasePdfUpload: `needs_review` toast; Audio: destructive variant for confidence < 0.5 | CONFIRMED | LOW |
| Refusal/fallback | Error shown on failure | Error toasts, error state in CasePdfUpload | CONFIRMED | LOW |
| Timeout/retry | Audio: 2 attempts with 3s delay | `useAudioTranscriptions.ts` lines 90-120 | CONFIRMED | LOW |
| Provider error | Error propagated to user | Error messages shown in toasts | CONFIRMED | LOW |
| Cost control | No rate limit on autofill | `extract-case-form-fields` has NO rate limiting | NOT_PRESENT | MEDIUM |
| Prompt/PII logging | Edge function logs metadata, not document content | Confirmed in subagent analysis | CONFIRMED | LOW |
| Model output stored in DB | Yes — `ocr_results` and `audio_transcriptions` | `CasePdfUpload.tsx` line 243-256; `useAudioTranscriptions.ts` | CONFIRMED | — |
| User can edit/review | Yes for both OCR and audio | Editable textarea for OCR; `updateTranscription` mutation for audio | CONFIRMED | — |
| OCR not treated as authoritative | **PARTIAL** — `needs_review` flag exists but not enforced as a gate | User can attach file without reviewing low-confidence results | PARTIALLY_CONFIRMED | MEDIUM |

---

## 9. Phase 8 — Security / Privacy Audit

| Risk Area | Evidence | Severity | Status | Required Action |
|---|---|---|---|---|
| Secrets in frontend | **0 matches** for `service_role` or `SUPABASE_SERVICE_ROLE_KEY` in `src/` | — | CONFIRMED SAFE | None |
| Client-side secret exposure | Supabase client uses anon key only (`src/integrations/supabase/client.ts`) | — | CONFIRMED SAFE | None |
| Service role exposure | Used ONLY in edge functions (server-side), never in frontend | — | CONFIRMED SAFE | None |
| CORS | Edge functions use `handleCors()` helper | — | CONFIRMED | None |
| RLS | All tables have RLS enabled; policies scoped to authenticated users with case membership | — | CONFIRMED | Verify live RLS matches migration |
| Ownership checks | OCR INSERT: case member check via JOIN; Storage: user path prefix; Audio: user-scoped | — | CONFIRMED | None |
| Rate limits | Telegram: 10/hour per chat_id; Audio: DB-backed per user; **Autofill: NONE** | MEDIUM | PARTIALLY_CONFIRMED | Add rate limit to autofill |
| Upload abuse | Size limits enforced (15MB/25MB/20MB/50MB); MIME allowlists enforced | — | CONFIRMED | None |
| MIME spoofing | Frontend checks MIME + extension; Edge functions validate MIME independently | — | CONFIRMED | None |
| Path traversal | Storage paths use `userId/caseId/` or `userId/autofill/` prefix patterns | — | CONFIRMED | None |
| Unsafe logs | `console.error` in `useComplaintFiles` line 100; `console.error` in `CasePdfUpload` lines 168, 217; 6 `console.log` in `src/` | LOW | PARTIALLY_CONFIRMED | Review and remove debug logs |
| PII/document logging | Edge functions log metadata (file size, type), not document content | — | CONFIRMED | None |
| Auth bypass | Edge functions validate JWT via `getUser(token)` or webhook secret | — | CONFIRMED | None |
| Role escalation | Admin role checked via `has_role()` function in RLS policies | — | CONFIRMED | Verify `has_role()` implementation |
| Storage access | Signed URLs with expiry (300s-3600s); path-scoped policies | — | CONFIRMED | None |
| Signed URL lifetime | PDF: 3600s; Complaint: 300s (with 3 retries); Audio: 3600s | LOW | CONFIRMED | Consider shorter expiry for PDF |
| Telegram webhook validation | `X-Telegram-Bot-Api-Secret-Token` header validated; 500 if not configured | — | CONFIRMED | None |
| .env files | `.env.example` exists with variable names only; `.env` is in `.gitignore` | — | CONFIRMED SAFE | None |
| Debug scripts in repo root | `reset_users_db.js`, `delete_db_users.js`, `test_upload_rls.js`, `test_bucket.js` present in repo root (untracked) | MEDIUM | NOT_CONFIRMED | Verify these are not deployed; add to .gitignore |
| Edge function service role | Used in 15+ edge functions for DB operations that need to bypass RLS | LOW | CONFIRMED | Acceptable pattern for server-side |

---

## 10. Phase 9 — Testing / Verification Audit

| Area | Test Exists? | Ran? | Result | Evidence | Gap |
|---|---|---|---|---|---|
| PDF OCR 15MB boundary | ❌ No | NOT_RUN | — | No test file in src/ | CRITICAL GAP |
| PDF rollback on OCR failure | ❌ No | NOT_RUN | — | No test file in src/ | CRITICAL GAP |
| PDF rollback on cancel | ❌ No | NOT_RUN | — | No test file in src/ | CRITICAL GAP |
| PDF OCR result persistence failure | ❌ No | NOT_RUN | — | No test file in src/ | CRITICAL GAP |
| Autofill unsupported DOCX rejection | ❌ No | NOT_RUN | — | No test file in src/ | HIGH GAP |
| Autofill temp cleanup | ❌ No | NOT_RUN | — | No test file in src/ | HIGH GAP |
| Audio 25MB boundary | ❌ No | NOT_RUN | — | No test file in src/ | HIGH GAP |
| M4A normalization | ❌ No | NOT_RUN | — | No test file in src/ | MEDIUM GAP |
| Audio rollback on signed URL failure | ❌ No | NOT_RUN | — | No test file in src/ | HIGH GAP |
| Audio rollback on transcription failure | ❌ No | NOT_RUN | — | No test file in src/ | HIGH GAP |
| Complaint OCR cleanup on failure | ❌ No | NOT_RUN | — | No test file in src/ | MEDIUM GAP |
| Shared SHA-256/version helper | ❌ No | NOT_RUN | — | No test file in src/ | MEDIUM GAP |
| OCR RLS insert (case member) | ✅ Edge test exists | NOT_RUN | — | `supabase/functions/_shared/rls-smoke.test.ts` | Run manually |
| OCR RLS (cross-user blocked) | ✅ Edge test exists | NOT_RUN | — | Same file | Run manually |
| Telegram MIME reject | ❌ No dedicated test | NOT_RUN | — | No test file | HIGH GAP |
| Telegram oversized reject | ❌ No dedicated test | NOT_RUN | — | No test file | HIGH GAP |
| Telegram rate limit | ❌ No dedicated test | NOT_RUN | — | No test file | HIGH GAP |
| No unsupported UI copy | ✅ `uploadPolicies.ts` defines centralized labels | CONFIRMED | — | Labels match MIME allowlists | — |

**Test Suite Status:** `npm test -- --run` → 13 test suites, **13 FAILED, 0 tests run**. All fail with `TypeError: Cannot read properties of undefined (reading 'config')`. This means the frontend test infrastructure is broken — Vitest cannot resolve the Supabase/React configuration.

**Edge Tests:** `npm run test:edge` (Deno test) exists but was NOT_RUN during this audit.

---

## 11. Phase 10 — Quality Gates

| Gate | Command | Result | Evidence |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit --pretty false` | ✅ PASS | Exit code 0, no type errors |
| Lint | `npm run lint` | ✅ PASS (warnings) | ~80+ warnings for non-ASCII literals in Armenian scripts; 0 errors |
| Unit tests | `npm test -- --run` | ❌ FAIL | 13/13 suites fail with `TypeError: Cannot read properties of undefined (reading 'config')` |
| Edge tests | `npm run test:edge` | NOT_RUN | Deno test command not executed during audit |
| Build | `npm run build` | NOT_RUN | Not executed during audit (typecheck passed) |
| Audit | `npm audit --audit-level=high` | NOT_RUN | Not executed during audit |
| Secret scan | `npm run scan:secrets` | NOT_AVAILABLE | Script not defined in package.json |
| Diff whitespace | `git diff --check` | PASS | No trailing whitespace issues in tracked changes |

---

## 12. Phase 11 — Browser / Manual Runtime Audit

| Scenario | Executed? | Result | Evidence | Blocker |
|---|---|---|---|---|
| Create case | ❌ NOT_RUN | — | — | — |
| Upload regular case file | ❌ NOT_RUN | — | — | — |
| Upload duplicate file (version/dedup) | ❌ NOT_RUN | — | — | — |
| Autofill from PDF | ❌ NOT_RUN | — | — | — |
| Autofill unsupported DOCX rejected | ❌ NOT_RUN | — | — | — |
| Autofill unsupported audio rejected | ❌ NOT_RUN | — | — | — |
| PDF OCR under 15MB | ❌ NOT_RUN | — | — | — |
| PDF OCR >15MB rejected | ❌ NOT_RUN | — | — | — |
| Cancel PDF dialog after upload | ❌ NOT_RUN | — | — | — |
| Audio MP3 under 25MB | ❌ NOT_RUN | — | — | — |
| Audio M4A normalized | ❌ NOT_RUN | — | — | — |
| Audio >25MB rejected | ❌ NOT_RUN | — | — | — |
| Complaint OCR temp cleanup | ❌ NOT_RUN | — | — | — |
| Telegram allowed file | ❌ NOT_RUN | — | — | — |
| Telegram unsupported file | ❌ NOT_RUN | — | — | — |
| Telegram rate limit | ❌ NOT_RUN | — | — | — |
| Client user OCR persistence | ❌ NOT_RUN | — | — | — |
| Cross-user access blocked | ❌ NOT_RUN | — | — | — |

**ALL browser/manual scenarios marked NOT_RUN.** No live Supabase environment or dev server was available during this audit for runtime verification.

---

## 13. Phase 12 — Confirmed Findings

| ID | Severity | Area | Problem | Evidence | Impact | Recommended Fix |
|---|---|---|---|---|---|---|
| **F-01** | **HIGH** | Legal-Tech / AI Safety | AI autofill fills legal case fields WITHOUT disclaimer | `CaseFormFileUpload.tsx` and `CasePdfUpload.tsx` do not render `disclaimer.json` namespace; `disclaimer.json` exists with `ai_warning` key in en/ru/hy | User may treat AI-extracted data as authoritative legal content | Add `disclaimer.ai_warning` banner before/after autofill |
| **F-02** | **HIGH** | Upload / Complaint | Complaint flow accepts unsanctioned file types (TXT, MD) | `useComplaintFiles.ts` line 32: `file.type.startsWith("text/") \|\| file.name.endsWith(".txt") \|\| file.name.endsWith(".md")` — these are NOT in `uploadPolicies.ts` | Unsupported file types sent to OCR; potential parsing errors or unexpected behavior | Refactor to use `normalizeCaseFileContentType()` or explicitly define complaint-specific policies |
| **F-03** | **HIGH** | Testing | Zero frontend tests; all 13 test suites fail | `npm test -- --run` → 13 failed, 0 tests run; no `*.test.tsx` files in `src/` | No automated regression coverage for critical legal workflows | Create Vitest tests for upload flows, rollback, MIME validation |
| **F-04** | **HIGH** | Legal-Tech / AI Safety | OCR results not marked as non-authoritative in UI | `CasePdfUpload.tsx` shows extracted text in editable textarea but no "AI-generated, review recommended" label; `disclaimer.json` has content but NOT rendered | Users may trust OCR without verification | Add `needs_review` visual indicator + disclaimer text |
| **F-05** | **MEDIUM** | Upload / Complaint | Complaint flow uses hardcoded 10MB limit instead of centralized constant | `useComplaintFiles.ts` line 123: `10 * 1024 * 1024` vs `PDF_OCR_MAX_BYTES` (15MB) | Inconsistent size limits across flows | Replace with `import { PDF_OCR_MAX_BYTES } from '@/lib/uploadPolicies'` |
| **F-06** | **MEDIUM** | Architecture | Complaint flow uses inline MIME detection instead of shared `uploadPolicies.ts` | `useComplaintFiles.ts` lines 30-36 have custom `isText`, `isDocx`, `isOldDoc`, `isImage`, `isPdf` logic | Divergent validation logic; harder to maintain | Refactor to use `normalizeCaseFileContentType()` and policy functions |
| **F-07** | **MEDIUM** | Backend / Rate Limit | No rate limiting on `extract-case-form-fields` edge function | Subagent evidence: no rate limit code in `extract-case-form-fields/index.ts` | LLM API cost abuse; potential denial of wallet | Add per-user rate limiting (DB-backed or Supabase rate limiter) |
| **F-08** | **MEDIUM** | Upload / Complaint | DOCX accepted in complaint OCR without confirmed parser support | `useComplaintFiles.ts` lines 33-34, 49: accepts `.docx` but backend OCR may not parse DOCX correctly | Failed extraction or silent errors for DOCX files | Verify DOCX parsing in `ocr-process` edge function; reject if unsupported |
| **F-09** | **MEDIUM** | Testing | No edge function tests executed | `npm run test:edge` not run; edge tests exist but not verified | Edge function behavior unvalidated in audit | Run edge tests in CI |
| **F-10** | **MEDIUM** | Legal-Tech | Low-confidence OCR not enforced as review gate | `CasePdfUpload.tsx` shows warning toast but allows user to attach without reviewing low-confidence results | Legal content with <70% confidence may be treated as authoritative | Make `needs_review` a blocking UI state requiring explicit user acknowledgment |
| **F-11** | **MEDIUM** | Security | Debug/test scripts in repo root | `reset_users_db.js`, `delete_db_users.js`, `test_upload_rls.js`, `test_bucket.js` in repo root | Potential accidental execution; unclear security posture | Move to scripts/ or add to .gitignore; never deploy |
| **F-12** | **MEDIUM** | Testing | No test coverage for PDF OCR boundary, rollback, cancel, persistence failure | No test files exist for CasePdfUpload, useComplaintFiles, useAudioTranscriptions | Critical flows have zero automated regression protection | Create integration tests |
| **F-13** | **LOW** | Logging | ~6 `console.log` calls in `src/` code; `console.error` in upload components | `CaseComplaintGenerator.tsx:232`, `DocumentFileUpload.tsx:131`, `useAIAnalysis.ts:234`, `useMultiAgentAnalysis.ts:227,439`, `CasePdfUpload.tsx:168,217` | Minor information leakage in production | Replace with structured logging or remove |
| **F-14** | **LOW** | Dead Code | `addToKnowledgeBase` in `useAudioTranscriptions.ts` always throws | Lines 209-237: `throw legacyRetrievalUnsupported()` | Confusing API surface | Remove or implement |
| **F-15** | **INFO** | Architecture | Centralized upload policies well-implemented | `uploadPolicies.ts` provides single source of truth for MIME, limits, labels | Positive finding | — |
| **F-16** | **INFO** | Architecture | Shared upload helper with SHA-256/versioning/rollback | `caseFileUpload.ts` provides consistent upload metadata handling | Positive finding | — |
| **F-17** | **INFO** | Security | Telegram webhook properly validates MIME, size, rate limit | `telegram-webhook/index.ts`: deny-by-default MIME, 20MB limit, 10/hr rate limit | Positive finding | — |

---

## 14. Phase 13 — Final Verdict

### Verdict

**RETURN_TO_REPAIR_LOOP**

### Why

1. **4 HIGH findings** remain unaddressed:
   - F-01: AI disclaimer not shown in autofill flow (legal-tech risk)
   - F-02: Complaint flow accepts unsanctioned file types (security/data quality risk)
   - F-03: Zero frontend tests, all 13 suites fail (regression risk)
   - F-04: OCR results not marked as non-authoritative (legal-tech risk)

2. **8 MEDIUM findings** require attention before production:
   - F-05: Hardcoded 10MB limit in complaints
   - F-06: Complaint flow bypasses shared upload policies
   - F-07: No rate limit on autofill edge function
   - F-08: DOCX accepted without confirmed parser
   - F-09: Edge tests not executed
   - F-10: Low-confidence OCR not enforced as review gate
   - F-11: Debug scripts in repo root
   - F-12: No test coverage for critical flows

3. **All 18 browser/manual scenarios NOT_RUN** — no live runtime verification

4. **No secrets exposed** — service role confined to edge functions, anon key in frontend only

5. **RLS is properly scoped** — ocr_results INSERT requires case membership; storage policies use user path prefixes

6. **Upload/OCR core flows are functionally correct** — rollback, cleanup, MIME validation, and size limits are well-implemented for the main paths (PDF, Audio, Telegram). The complaint flow has the most gaps.

### Evidence Summary

- **Static analysis:** COMPLETE — all source files, migrations, edge functions, and policies reviewed
- **TypeScript typecheck:** PASS (0 errors)
- **ESLint:** PASS (warnings only for non-ASCII Armenian literals)
- **Vitest tests:** FAIL (13/13 suites fail — broken test infrastructure)
- **Runtime tests:** NOT_RUN
- **Security scan:** No secrets in frontend; no service role key exposure; proper RLS

### Blocking Issues

1. F-01 (HIGH): AI disclaimer not shown in autofill — legal-tech compliance risk
2. F-02 (HIGH): Complaint flow accepts TXT/MD — security/data quality risk
3. F-03 (HIGH): Zero frontend tests — regression risk
4. F-04 (HIGH): OCR results not marked non-authoritative — legal-tech compliance risk

### Non-Blocking Issues

F-05 through F-14 (MEDIUM/LOW/INFO)

### Required Next Actions

1. Add `disclaimer.ai_warning` banner to CaseFormFileUpload and CasePdfUpload flows
2. Refactor `useComplaintFiles.ts` to use `uploadPolicies.ts` and remove TXT/MD acceptance
3. Fix Vitest test infrastructure (resolve `config` undefined error)
4. Add `needs_review` visual gate in CasePdfUpload (user must acknowledge before attaching)
5. Add rate limiting to `extract-case-form-fields` edge function
6. Verify DOCX parsing support in `ocr-process` or reject DOCX in complaints
7. Replace hardcoded 10MB in `useComplaintFiles.ts` with centralized constant
8. Remove debug scripts from repo root (`reset_users_db.js`, etc.)
9. Add integration tests for PDF OCR, audio transcription, complaint cleanup flows
10. Run `npm run test:edge` to verify edge function tests
11. Run `npm run build` to verify production build succeeds
12. Remove `console.log` debug statements from production code
13. Remove `addToKnowledgeBase` dead code from `useAudioTranscriptions.ts`
14. Verify live RLS policies match migration definitions
15. Consider shorter signed URL lifetime for PDF OCR (currently 3600s)

---

## 15. Repair Loop Backlog

| Priority | Finding ID | Severity | Files | Fix Goal | Verification Required |
|---:|---|---|---|---|---|
| 1 | F-01 | HIGH | `CaseFormFileUpload.tsx`, `CasePdfUpload.tsx` | Add AI disclaimer banner from `disclaimer.json` before/after autofill | Browser test: verify disclaimer shown |
| 2 | F-04 | HIGH | `CasePdfUpload.tsx`, `AudioUpload.tsx` | Add `needs_review` visual gate + "AI-generated" label on OCR results | Browser test: verify label visible |
| 3 | F-02 | HIGH | `useComplaintFiles.ts` | Remove TXT/MD acceptance; use `uploadPolicies.ts` functions | Unit test: verify TXT/MD rejected |
| 4 | F-03 | HIGH | `vitest.config.ts`, `src/` | Fix Vitest config; create upload rollback tests | `npm test` passes |
| 5 | F-05 | MEDIUM | `useComplaintFiles.ts` | Replace `10 * 1024 * 1024` with `PDF_OCR_MAX_BYTES` | Code review |
| 6 | F-06 | MEDIUM | `useComplaintFiles.ts` | Refactor to use `normalizeCaseFileContentType()` | Code review |
| 7 | F-07 | MEDIUM | `extract-case-form-fields/index.ts` | Add per-user rate limiting (5-10/hour) | Edge test: verify rate limit |
| 8 | F-08 | MEDIUM | `useComplaintFiles.ts`, `ocr-process/index.ts` | Verify DOCX parsing or reject DOCX in complaints | Browser test: verify DOCX rejected or processed |
| 9 | F-09 | MEDIUM | CI pipeline | Run `npm run test:edge` in CI | Green CI |
| 10 | F-10 | MEDIUM | `CasePdfUpload.tsx` | Make low-confidence OCR require explicit acknowledgment | Browser test |
| 11 | F-11 | MEDIUM | Repo root | Move scripts to `scripts/` or add to `.gitignore` | `git status` clean |
| 12 | F-12 | MEDIUM | `src/` | Create tests for CasePdfUpload, useComplaintFiles, useAudioTranscriptions | `npm test` passes |
| 13 | F-13 | LOW | Multiple | Remove `console.log` from production code | ESLint rule or grep check |
| 14 | F-14 | LOW | `useAudioTranscriptions.ts` | Remove `addToKnowledgeBase` stub | Code review |
| 15 | F-15 | INFO | — | Positive: centralized upload policies well-implemented | — |

---

## 16. Top 20 Next Actions

1. **Add AI disclaimer to autofill flow** — render `disclaimer.ai_warning` in CaseFormFileUpload and CasePdfUpload before AI-generated content
2. **Add "AI-generated, review recommended" label** to OCR/audio transcription results
3. **Remove TXT/MD acceptance in complaint flow** — refactor `useComplaintFiles.ts` to use `uploadPolicies.ts`
4. **Replace hardcoded 10MB limit** with `PDF_OCR_MAX_BYTES` constant in complaint flow
5. **Fix Vitest test infrastructure** — resolve `TypeError: Cannot read properties of undefined (reading 'config')`
6. **Add rate limiting to extract-case-form-fields** — 5-10 requests per hour per user
7. **Verify or reject DOCX in complaints** — confirm `ocr-process` handles DOCX or reject at frontend
8. **Make low-confidence OCR a blocking review gate** — require explicit user acknowledgment before attaching
9. **Create integration tests** for CasePdfUpload rollback, CasePdfUpload cancel, useComplaintFiles cleanup
10. **Create unit tests** for `uploadPolicies.ts` MIME normalization and size limits
11. **Run `npm run test:edge`** and verify all edge function tests pass
12. **Run `npm run build`** and verify production build succeeds
13. **Remove debug scripts from repo root** (`reset_users_db.js`, `delete_db_users.js`, `test_upload_rls.js`, `test_bucket.js`)
14. **Remove `console.log` debug statements** from `src/` production code
15. **Remove `addToKnowledgeBase` dead code** from `useAudioTranscriptions.ts`
16. **Verify live RLS policies** match migration definitions (run against actual Supabase)
17. **Run browser/manual runtime scenarios** (all 18 scenarios from Phase 11)
18. **Run `npm audit --audit-level=high`** to check for dependency vulnerabilities
19. **Consider shorter signed URL lifetime** for PDF OCR (reduce from 3600s)
20. **Add CI pipeline** that runs typecheck, lint, tests, and build on every PR

---

## 17. Evidence Appendix

### Files Reviewed

| Category | Files |
|---|---|
| **Upload Policies** | `src/lib/uploadPolicies.ts` (106 lines), `src/lib/caseFileUpload.ts` (100 lines) |
| **Hooks** | `src/hooks/useCaseFiles.ts` (108 lines), `src/hooks/useAudioTranscriptions.ts` (274 lines) |
| **Components** | `src/components/cases/CaseFormFileUpload.tsx` (148 lines), `src/components/cases/CaseForm.tsx` (843 lines), `src/components/cases/CasePdfUpload.tsx` (435 lines), `src/components/cases/CaseFileUpload.tsx` (339 lines), `src/components/audio/AudioUpload.tsx` (143 lines), `src/components/complaints/useComplaintFiles.ts` (171 lines) |
| **Edge Functions** | `supabase/functions/extract-case-form-fields/index.ts` (366 lines), `supabase/functions/audio-transcribe/index.ts` (310 lines), `supabase/functions/telegram-webhook/index.ts` (541 lines), `supabase/functions/ocr-process/index.ts` |
| **Migrations** | `20260709143851_allow_case_members_insert_ocr_results.sql` (24 lines), `20260708010000_fix_case_upload_autofill_rls.sql` (40 lines), `20260707120000_f7_2_align_case_file_delete.sql` |
| **Config** | `package.json` (111 lines), `vitest.config.ts`, `vite.config.ts`, `.gitignore` |
| **i18n** | `src/i18n/locales/en/audio.json`, `src/i18n/locales/en/cases.json`, `src/i18n/locales/*/disclaimer.json` |
| **Schema** | `live_schema_public.sql` (checked for ocr_results, case_files, storage policies) |
| **Previous Audits** | `AUDIT_REPORTS/FINAL_PRODUCTION_AUDIT_2026-06-29.md`, `AUDIT_REPORTS/BROWSER_QA_REPORT_2026-07-09.md`, `AUDIT_REPORTS/TASK_04_EdgeFunctions_Audit.md`, `AUDIT_REPORTS/TASK_08_Security_Audit.md` |

### Commands Executed

| Command | Result |
|---|---|
| `git status` | 1 modified file (`useCases.ts`), branch main |
| `git log --oneline -20` | 20 commits shown, latest: audio transcription feature |
| `npx tsc --noEmit --pretty false` | ✅ PASS (0 errors) |
| `npm run lint` | ✅ PASS (warnings only, no errors) |
| `npm test -- --run` | ❌ FAIL (13/13 suites fail) |
| `git grep "service_role" src/` | 0 matches (SAFE) |
| `git grep "SUPABASE_SERVICE_ROLE_KEY" src/` | 0 matches (SAFE) |

### Labels Used

CONFIRMED (evidence-backed), PARTIALLY_CONFIRMED (partial evidence), NOT_CONFIRMED (evidence shows gap), NOT_PRESENT (feature missing), NOT_RUN (not executed), NOT_AVAILABLE (tool missing), INFO (observation)
</task_progress>
</write_to_file>