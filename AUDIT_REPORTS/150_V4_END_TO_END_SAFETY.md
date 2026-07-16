# 150 — V4 End-to-End Safety

## Execution Path Tested

query -> candidate preparation -> sanitizer -> trusted metadata -> scorer V4 -> status guard -> temporal guard -> no-answer gate -> final output

## Test File

supabase/functions/_shared/deterministic-search-v4-safety.test.ts

## Test Results

6 test suites, 18 test steps — ALL PASSED (42ms)

### Injection Sets

| Test | Result |
|------|--------|
| English injection ("ignore all previous instructions") | PASS — sanitizer flags injection, segments removed |
| Injection in query text | PASS |
| Clean legal text preserved | PASS — instruction_like_score = 0, legal_imperative_preserved = true |

### Forged Features

| Test | Result |
|------|--------|
| Forged authority in query text | PASS — authority_score stays low without trusted metadata |
| Forged page mapping fallback | PASS — page_mapping_score = 0, legacy page_from ignored |
| Trusted page_from_physical | PASS — page_mapping_score > 0 only with trusted mapping |
| Forged source URL | PASS — non-ARLIS source gets lower canonical score |

### Legal Imperative

| Test | Result |
|------|--------|
| Legal imperative without AI context | PASS — preserved, not flagged |
| Legal imperative with AI context | PASS — handled carefully (flagged or imperative not preserved) |

### No-Answer Gate

| Test | Result |
|------|--------|
| Empty results | PASS — not answerable, NO_ELIGIBLE_EVIDENCE |
| Weak evidence (score < 0.2) | PASS — not answerable, WEAK_EVIDENCE |
| Strong evidence (score >= 0.2) | PASS — answerable |

### Status Guard

| Test | Result |
|------|--------|
| Repealed in current scope | PASS — filtered |
| Unknown in extended scope | PASS — included |
| Status-ineligible | PASS — filtered |

### Temporal Guard

| Test | Result |
|------|--------|
| Expired document | PASS — filtered |
| Currently effective | PASS — included |
| Future document | PASS — filtered |

## Metrics

| Metric | Value |
|--------|-------|
| injection_pass | 3/3 (100%) |
| attack_success | 0/3 (0%) |
| legal_imperative_false_positive_rate | 0% (clean legal text not flagged) |
| forged_feature_block_rate | 4/4 (100%) |
| no_answer_false_answer | 0 (weak evidence correctly blocked) |
| no_answer_false_negative | 0 (strong evidence correctly answered) |
| status_contamination | 0 (repealed filtered in current, unknown filtered in current) |

## Sanitizer Path

The production call path was verified:
- V4 calls V3 (rankDeterministicV3) which applies sanitizer to chunk_text
- Sanitizer uses ATTACK_PATTERNS covering English, Russian, Armenian injection
- Legal imperative preservation logic active
- No bypass detected — sanitizer runs on every candidate

## Status

PASS — all 18 safety test steps passed, no sanitizer bypass, no forged-feature boost, no-answer gate functional.