#!/usr/bin/env python3
"""Measure independent-review agreement and prepare adjudication records."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def weighted_kappa(a: list[int], b: list[int], levels: int = 4) -> float | None:
    if not a:
        return None
    n = len(a)
    observed = sum(((x - y) / (levels - 1)) ** 2 for x, y in zip(a, b)) / n
    ca, cb = Counter(a), Counter(b)
    expected = sum(
        ca[i] * cb[j] / (n * n) * ((i - j) / (levels - 1)) ** 2
        for i in range(levels)
        for j in range(levels)
    )
    return (
        1.0
        if expected == 0 and observed == 0
        else (None if expected == 0 else 1 - observed / expected)
    )


def agreement(a: list[Any], b: list[Any]) -> float | None:
    return None if not a else sum(x == y for x, y in zip(a, b)) / len(a)


def measure(
    labels_a: Path, labels_b: Path, metrics_path: Path, disagreements_path: Path
) -> dict[str, Any]:
    left = {row["review_item_id"]: row for row in read_jsonl(labels_a)}
    right = {row["review_item_id"]: row for row in read_jsonl(labels_b)}
    common = sorted(left.keys() & right.keys())
    pairs = [(left[key], right[key]) for key in common]
    fields = [
        "answerable",
        "status_correct",
        "citation_document_correct",
        "citation_provision_correct",
    ]
    by_intent: dict[str, list[tuple[dict[str, Any], dict[str, Any]]]] = defaultdict(
        list
    )
    disagreements: list[dict[str, Any]] = []
    for a, b in pairs:
        by_intent[str(a.get("intent"))].append((a, b))
        differing = [
            field
            for field in ["legal_relevance", *fields]
            if a.get(field) != b.get(field)
        ]
        if differing:
            disagreements.append(
                {
                    "review_item_id": a["review_item_id"],
                    "query_id": a.get("query_id"),
                    "candidate_id": a.get("candidate_id"),
                    "differing_fields": differing,
                    "reviewer_a_label": a,
                    "reviewer_b_label": b,
                    "adjudicated_label": None,
                    "adjudicator_id": None,
                    "adjudicated_at": None,
                }
            )
    relevance_a = [int(a["legal_relevance"]) for a, _ in pairs]
    relevance_b = [int(b["legal_relevance"]) for _, b in pairs]
    metrics = {
        "status": "COMPLETE"
        if pairs and len(common) == len(left) == len(right)
        else "INCOMPLETE",
        "reviewer_a_labels": len(left),
        "reviewer_b_labels": len(right),
        "matched_pairs": len(pairs),
        "weighted_kappa_legal_relevance": weighted_kappa(relevance_a, relevance_b),
        "agreement": {
            field: agreement([a[field] for a, _ in pairs], [b[field] for _, b in pairs])
            for field in fields
        },
        "agreement_by_intent": {
            intent: {
                "count": len(group),
                "legal_relevance": agreement(
                    [a["legal_relevance"] for a, _ in group],
                    [b["legal_relevance"] for _, b in group],
                ),
            }
            for intent, group in sorted(by_intent.items())
        },
        "disagreement_count": len(disagreements),
        "adjudication_complete": False,
        "legal_gold_status": "ENGINEERING_GOLD_PENDING_LEGAL_REVIEW",
    }
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    disagreements_path.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in disagreements),
        encoding="utf-8",
    )
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--labels-a", type=Path, required=True)
    parser.add_argument("--labels-b", type=Path, required=True)
    parser.add_argument("--metrics", type=Path, required=True)
    parser.add_argument("--disagreements", type=Path, required=True)
    args = parser.parse_args()
    print(
        json.dumps(
            measure(args.labels_a, args.labels_b, args.metrics, args.disagreements),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
