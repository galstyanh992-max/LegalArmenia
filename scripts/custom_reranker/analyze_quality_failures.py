#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    cases = [
        row
        for row in read_jsonl(args.artifacts / "prompt19_2_gold_test.jsonl")
        if row["answerable"]
    ]
    pools = {
        row["query_id"]: {
            candidate["candidate_id"]: candidate for candidate in row["candidates"]
        }
        for row in read_jsonl(args.artifacts / "prompt19_2_candidate_pools.jsonl")
    }
    runs = {
        row["query_id"]: row
        for row in json.loads(
            (args.artifacts / "prompt19_2_system_d_all.json").read_text(
                encoding="utf-8"
            )
        )["runs"]
    }
    failures = []
    for case in cases:
        ranking = runs[case["query_id"]]["ranking"]
        top_id = ranking[0] if ranking else None
        top = pools[case["query_id"]].get(top_id, {})
        expected_docs = set(case.get("expected_document_ids", []))
        expected_chunks = set(case.get("expected_chunk_ids", []))
        document_ok = bool(top_id) and (
            top_id in expected_chunks or top.get("document_id") in expected_docs
        )
        provision_ok = bool(top_id) and top_id in expected_chunks
        if document_ok and provision_ok:
            continue
        expected_in_pool = [
            cid
            for cid, candidate in pools[case["query_id"]].items()
            if cid in expected_chunks or candidate.get("document_id") in expected_docs
        ]
        reasons = []
        if not ranking:
            reasons.append("EMPTY_AFTER_LEGAL_GUARDS")
        if not expected_in_pool:
            reasons.append("EXPECTED_SOURCE_MISSING_FROM_POOL")
        elif not document_ok:
            reasons.append("WRONG_TOP_DOCUMENT")
        if document_ok and not provision_ok:
            reasons.append("CORRECT_DOCUMENT_WRONG_CHUNK_OR_PROVISION")
        if top and not top.get("citation_anchor"):
            reasons.append("TOP_CITATION_ANCHOR_MISSING")
        metadata = top.get("citation_metadata") or {}
        if not metadata.get("article_number"):
            reasons.append("TOP_ARTICLE_METADATA_MISSING")
        failures.append(
            {
                "query_id": case["query_id"],
                "top_candidate_id": top_id,
                "expected_candidate_ids_in_pool": expected_in_pool,
                "document_correct": document_ok,
                "provision_correct": provision_ok,
                "reason_codes": reasons,
            }
        )
    payload = {
        "citation_document_accuracy": 1
        - sum(not row["document_correct"] for row in failures) / len(cases),
        "citation_provision_accuracy": 1
        - sum(not row["provision_correct"] for row in failures) / len(cases),
        "answerable_test_cases": len(cases),
        "failure_count": len(failures),
        "reason_counts": Counter(
            reason for row in failures for reason in row["reason_codes"]
        ),
        "page_citations_fabricated": 0,
        "release_gate_passed": False,
        "repair_conclusion": "Candidate generation/metadata and legally reviewed provision labels must be repaired before reranker training can reach citation 1.00.",
        "failures": failures,
    }
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, default=dict) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                key: payload[key]
                for key in (
                    "citation_document_accuracy",
                    "citation_provision_accuracy",
                    "failure_count",
                    "reason_counts",
                )
            },
            indent=2,
            default=dict,
        )
    )


if __name__ == "__main__":
    main()
