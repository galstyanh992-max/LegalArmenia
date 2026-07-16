from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.artifacts
    manifest = json.loads((root / "prompt19_2_dataset_manifest.json").read_text(encoding="utf-8"))
    checks: dict[str, dict] = {}

    def check(name: str, passed: bool, evidence: object) -> None:
        checks[name] = {"passed": bool(passed), "evidence": evidence}

    files = {
        "dataset": ("prompt19_2_frozen_gold.jsonl", manifest["dataset_sha256"]),
        "corpus": ("prompt19_2_corpus_snapshot.jsonl", manifest["corpus_snapshot_sha256"]),
        "candidate_pool": ("prompt19_2_candidate_pools.jsonl", manifest["candidate_pool_sha256"]),
        "blinded_pool": ("prompt19_2_blinded_candidate_pools.jsonl", manifest["blinded_pool_sha256"]),
    }
    for name, (filename, expected) in files.items():
        actual = sha256(root / filename)
        check(f"{name}_sha256", actual == expected, {"expected": expected, "actual": actual})

    gold = jsonl(root / "prompt19_2_frozen_gold.jsonl")
    pools = jsonl(root / "prompt19_2_candidate_pools.jsonl")
    blinded = jsonl(root / "prompt19_2_blinded_candidate_pools.jsonl")
    snapshot = jsonl(root / "prompt19_2_corpus_snapshot.jsonl")
    split_counts = Counter(row["split"] for row in gold)
    intent_counts = Counter(row["intent"] for row in gold)
    check("gold_count", len(gold) == 280, len(gold))
    check("split_counts", dict(split_counts) == manifest["split_counts"], dict(split_counts))
    check("intent_counts", dict(intent_counts) == manifest["intent_counts"], dict(intent_counts))
    check("unique_query_ids", len({row["query_id"] for row in gold}) == len(gold), len({row["query_id"] for row in gold}))
    check("unique_snapshot_chunks", len({row["chunk_id"] for row in snapshot}) == len(snapshot) == 592, len(snapshot))
    families: dict[str, set[str]] = defaultdict(set)
    for row in gold:
        families[row["document_family_sha256"]].add(row["split"])
    leaking = {family: sorted(splits) for family, splits in families.items() if len(splits) > 1}
    check("document_family_split_leakage", not leaking, leaking)

    pool_ids = {row["query_id"] for row in pools}
    blinded_ids = {row["query_id"] for row in blinded}
    check("pool_query_coverage", pool_ids == {row["query_id"] for row in gold}, len(pool_ids))
    check("blinded_query_coverage", blinded_ids == pool_ids, len(blinded_ids))
    invalid_pools = []
    for pool in pools:
        ids = [candidate["chunk_id"] for candidate in pool["candidates"]]
        if len(ids) != 50 or len(set(ids)) != 50:
            invalid_pools.append(pool["query_id"])
    check("candidate_pool_cardinality_and_uniqueness", not invalid_pools, invalid_pools)
    hidden_fields = {"source_route", "model", "vector_score", "reranker_score", "system_rank", "metric_cosine_similarity", "ann_rank", "fts_rank", "rrf_score"}
    blinded_leaks = []
    for pool in blinded:
        for candidate in pool["candidates"]:
            leaked = sorted(hidden_fields.intersection(candidate))
            if leaked:
                blinded_leaks.append({"query_id": pool["query_id"], "fields": leaked})
                break
    check("blinded_pool_hides_routes_scores_and_ranks", not blinded_leaks, blinded_leaks[:10])

    fixtures = json.loads((root / "prompt19_2_injection_fixtures.json").read_text(encoding="utf-8"))
    fixture_rows = fixtures if isinstance(fixtures, list) else fixtures.get("fixtures", [])
    check("injection_fixture_count", len(fixture_rows) == 10, len(fixture_rows))

    raw_expectations = {
        "GTE": "prompt19_2_gte_test_live.json",
        "BGE": "prompt19_2_bge_test_live.json",
    }
    for model, filename in raw_expectations.items():
        result = json.loads((root / filename).read_text(encoding="utf-8"))
        run_count = len(result["runs"])
        invalid = [run["query_id"] for run in result["runs"] if len(run.get("raw_scores", [])) != 50]
        check(f"{model.lower()}_raw_score_coverage", run_count == 56 and not invalid, {"runs": run_count, "invalid": invalid})

    final_expectations = {
        "GTE": ("prompt19_2_gte_test_final.json", 0.05),
        "BGE": ("prompt19_2_bge_test_final.json", 0.05),
    }
    pool_by_query = {pool["query_id"]: {candidate["chunk_id"] for candidate in pool["candidates"]} for pool in pools}
    for model, (filename, weight) in final_expectations.items():
        result = json.loads((root / filename).read_text(encoding="utf-8"))
        invented = [run["query_id"] for run in result["runs"] if not set(run["ranking"]).issubset(pool_by_query[run["query_id"]])]
        check(f"{model.lower()}_final_weight", result["cross_encoder_weight"] == weight, result["cross_encoder_weight"])
        check(f"{model.lower()}_no_invented_ids", not invented, invented)

    calibration = json.loads((root / "prompt19_2_relevance_calibration.json").read_text(encoding="utf-8"))
    check("calibration_did_not_use_test", calibration["test_split_used_for_tuning"] is False, calibration["test_split_used_for_tuning"])
    check("legal_review_truthful", manifest["status"] == "ENGINEERING_GOLD_PENDING_LEGAL_REVIEW" and not manifest["legal_review_complete"], manifest["status"])
    check("production_writes_zero", manifest["production_writes"] == 0, manifest["production_writes"])

    output = {
        "passed": all(value["passed"] for value in checks.values()),
        "check_count": len(checks),
        "failed_checks": [name for name, value in checks.items() if not value["passed"]],
        "checks": checks,
    }
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in output.items() if key != "checks"}, indent=2))
    raise SystemExit(0 if output["passed"] else 1)


if __name__ == "__main__":
    main()
