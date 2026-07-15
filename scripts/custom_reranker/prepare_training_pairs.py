#!/usr/bin/env python3
"""Materialize compact pairwise training examples from the engineering dataset."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
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
    expanded = read_jsonl(
        args.artifacts
        / "prompt19_3_training_data"
        / "expanded_engineering_queries.jsonl"
    )
    negatives = read_jsonl(
        args.artifacts / "prompt19_3_training_data" / "hard_negatives.jsonl"
    )
    snapshot = {
        row["chunk_id"]: row
        for row in read_jsonl(args.artifacts / "prompt19_2_corpus_snapshot.jsonl")
    }
    pools = read_jsonl(args.artifacts / "prompt19_2_candidate_pools.jsonl")
    candidate_text = {
        candidate["candidate_id"]: candidate["text"]
        for pool in pools
        for candidate in pool["candidates"]
    }
    by_parent: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in expanded:
        by_parent[row["parent_query_id"]].append(row)
    negative_by_parent: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in negatives:
        negative_by_parent[row["parent_query_id"]].append(row)
    rows: list[dict[str, Any]] = []
    for parent, variants in sorted(by_parent.items()):
        variants.sort(key=lambda row: row["generated_template_id"])
        selected_variants = (
            variants[:3] if variants[0]["split"] == "train" else variants[:1]
        )
        positive_ids = variants[0]["expected_chunk_ids"]
        positive_id = next(
            (
                chunk_id
                for chunk_id in positive_ids
                if chunk_id in snapshot or chunk_id in candidate_text
            ),
            None,
        )
        selected_negatives = negative_by_parent[parent][:8]
        for variant in selected_variants:
            group_id = variant["query_id"]
            if positive_id:
                meta = snapshot.get(positive_id, {})
                rows.append(
                    {
                        "group_id": group_id,
                        "parent_query_id": parent,
                        "split": variant["split"],
                        "query": variant["query"],
                        "candidate_id": positive_id,
                        "candidate_text": meta.get("text")
                        or candidate_text[positive_id],
                        "label": 1.0,
                        "legal_relevance": 3,
                        "status_valid": 1.0,
                        "temporal_valid": 1.0,
                        "citation_match": 1.0,
                        "authority_match": 1.0,
                        "negative_type": None,
                    }
                )
            for negative in selected_negatives:
                candidate_id = negative["candidate_id"]
                meta = snapshot.get(candidate_id, {})
                text = (
                    negative.get("candidate_text")
                    or meta.get("text")
                    or candidate_text.get(candidate_id)
                )
                if not text:
                    continue
                status_valid = (
                    0.0 if negative["negative_type"] == "status_hard_negative" else 1.0
                )
                rows.append(
                    {
                        "group_id": group_id,
                        "parent_query_id": parent,
                        "split": variant["split"],
                        "query": variant["query"],
                        "candidate_id": candidate_id,
                        "candidate_text": text,
                        "label": 0.0,
                        "legal_relevance": 0,
                        "status_valid": status_valid,
                        "temporal_valid": 0.0
                        if negative["negative_type"] == "temporal_hard_negative"
                        else 1.0,
                        "citation_match": 0.0,
                        "authority_match": 0.0,
                        "negative_type": negative["negative_type"],
                    }
                )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    data = "".join(
        json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n"
        for row in rows
    )
    args.output.write_text(data, encoding="utf-8")
    manifest = {
        "pair_count": len(rows),
        "train_pair_count": sum(row["split"] == "train" for row in rows),
        "dev_pair_count": sum(row["split"] == "dev" for row in rows),
        "positive_count": sum(row["label"] == 1 for row in rows),
        "sha256": hashlib.sha256(data.encode()).hexdigest(),
        "frozen_test_pairs": 0,
        "legal_reviewed": False,
    }
    args.output.with_suffix(".manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
