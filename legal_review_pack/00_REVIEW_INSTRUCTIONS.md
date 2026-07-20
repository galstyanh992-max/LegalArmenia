# Licensed Lawyer Review — Instructions

Generated (UTC): 2026-07-20T15:53:00Z
Audience: a licensed lawyer qualified to practise Armenian law.
Status: BLOCKED_EXTERNAL_LEGAL_REVIEW_REQUIRED — reviewer fields are BLANK until completed by a real licensed lawyer.

## Purpose

This package asks a licensed lawyer to independently review the legal-answer behaviour of the AI Legal Armenia system: whether citations are accurate, whether claims are supported, whether no-answer behaviour is correct, and whether the system stays within legal-information boundaries rather than giving regulated legal advice.

## Who may NOT complete reviewer fields

AI systems, developers, QA engineers, and the project owner may NOT fill reviewer fields. Only a licensed lawyer may complete the attestation in 07_REVIEWER_ATTESTATION_TEMPLATE.md.

## What to review

1. 01_SYSTEM_BEHAVIOR_SUMMARY.md — what the system does.
2. 02_SEARCH_AND_CITATION_METHOD.md — how retrieval and citation work.
3. 03_ARMENIAN_GOLD_SAMPLE.jsonl — representative Armenian legal queries across legal domains. For each item, assess whether the system's cited authorities are correct, current, and properly attributed.
4. 04_HIGH_RISK_SCENARIOS.md — high-risk legal advice boundary scenarios.
5. 05_UNSUPPORTED_CLAIM_TESTS.md — cases where the system must NOT fabricate legal claims.
6. 06_REVIEW_FORM.md — record findings here.

## Required reviewer evidence (in 07)

- reviewer name
- professional qualification
- jurisdiction or licensing basis
- review date
- reviewed dataset/version hash
- findings
- blocking legal defects
- non-blocking recommendations
- approval or rejection
- signature or equivalent attestation

## Handling of results

The orchestrator will record the reviewer's conclusions without altering them, create remediation tasks for blocking findings, repair, re-run technical tests, and return only changed legal scenarios to the reviewer when appropriate. Final approval is required for LICENSED_LAWYER_REVIEW = PASS.
