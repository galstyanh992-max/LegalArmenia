#!/usr/bin/env python3
"""Build deterministic, rank-blinded legal review batches from Prompt 19.2."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path
from typing import Any


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def canonical_hash(rows: list[dict[str, Any]]) -> str:
    payload = "".join(
        json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
        for row in rows
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def build(
    artifacts: Path, output: Path, candidates_per_query: int, seed: int
) -> dict[str, Any]:
    gold = {
        row["query_id"]: row
        for row in read_jsonl(artifacts / "prompt19_2_frozen_gold.jsonl")
    }
    pools = read_jsonl(artifacts / "prompt19_2_blinded_candidate_pools.jsonl")
    snapshot = {
        row["chunk_id"]: row
        for row in read_jsonl(artifacts / "prompt19_2_corpus_snapshot.jsonl")
    }
    rows: list[dict[str, Any]] = []
    for pool in pools:
        case = gold[pool["query_id"]]
        candidates = list(pool["candidates"])
        rng = random.Random(f"{seed}:{pool['query_id']}")
        rng.shuffle(candidates)
        expected = set(case.get("expected_chunk_ids", []))
        selected = [
            candidate
            for candidate in candidates
            if candidate["candidate_id"] in expected
        ]
        selected_ids = {candidate["candidate_id"] for candidate in selected}
        selected.extend(
            candidate
            for candidate in candidates
            if candidate["candidate_id"] not in selected_ids
        )
        for candidate in selected[:candidates_per_query]:
            meta = snapshot.get(candidate["candidate_id"], {})
            item_key = f"{pool['query_id']}:{candidate['candidate_id']}"
            rows.append(
                {
                    "review_item_id": hashlib.sha256(item_key.encode()).hexdigest()[
                        :24
                    ],
                    "query_id": pool["query_id"],
                    "query": pool["query"],
                    "intent": case.get("intent"),
                    "content_domain": case.get("content_domain"),
                    "status_scope": case.get("status_scope"),
                    "effective_at": case.get("effective_at"),
                    "candidate_id": candidate["candidate_id"],
                    "candidate_text": candidate["text"],
                    "document_title": meta.get("title_hy") or meta.get("title_ru"),
                    "legal_status": candidate.get("trusted_metadata", {}).get(
                        "norm_status"
                    ),
                    "effective_from": candidate.get("trusted_metadata", {}).get(
                        "effective_from"
                    ),
                    "effective_to": candidate.get("trusted_metadata", {}).get(
                        "effective_to"
                    ),
                    "article": meta.get("article_number"),
                    "part": meta.get("part_number"),
                    "point": meta.get("point_number"),
                    "citation_anchor": meta.get("citation_anchor"),
                    "canonical_key": meta.get("canonical_key"),
                }
            )
    output.mkdir(parents=True, exist_ok=True)
    batch_hash = canonical_hash(rows)
    for slot in ("a", "b"):
        path = output / f"review_batch_{slot}.jsonl"
        path.write_text(
            "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
            encoding="utf-8",
        )
    manifest = {
        "status": "PREPARED_PENDING_REAL_REVIEWERS",
        "seed": seed,
        "query_count": len(pools),
        "candidate_pair_count": len(rows),
        "candidates_per_query": candidates_per_query,
        "canonical_batch_sha256": batch_hash,
        "blinded_fields_absent": [
            "retrieval_route",
            "source_model",
            "vector_score",
            "reranker_score",
            "system_rank",
        ],
        "reviewer_slots": ["A", "B"],
        "legal_approval_claimed": False,
    }
    (output / "review_batch_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--candidates-per-query", type=int, default=10)
    parser.add_argument("--seed", type=int, default=1930)
    args = parser.parse_args()
    if not 1 <= args.candidates_per_query <= 50:
        raise SystemExit("candidates-per-query must be 1..50")
    print(
        json.dumps(
            build(args.artifacts, args.output, args.candidates_per_query, args.seed),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
