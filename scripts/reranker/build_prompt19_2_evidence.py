from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path


SYSTEM_FILES = {
    "A_FTS": "prompt19_2_system_a_test.json",
    "B_METRIC_ANN": "prompt19_2_system_b_test.json",
    "C_FUSION": "prompt19_2_system_c_test.json",
    "D_LEGAL_SCORER": "prompt19_2_system_d_test.json",
    "E1_GTE": "prompt19_2_gte_test_final.json",
    "E2_BGE": "prompt19_2_bge_test_final.json",
}


def jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def dcg(values: list[int]) -> float:
    return sum((2**value - 1) / math.log2(index + 2) for index, value in enumerate(values))


def query_metrics(gold: dict, run: dict, pool: dict) -> dict:
    by_id = {candidate["chunk_id"]: candidate for candidate in pool["candidates"]}
    ranking = [by_id[item] for item in run["ranking"] if item in by_id]
    expected_docs = set(gold["expected_document_ids"])
    relevant = [candidate["document_id"] in expected_docs for candidate in ranking]
    first = next((index for index, value in enumerate(relevant) if value), None)
    relevance = [
        int(gold["graded_relevance"].get(candidate["chunk_id"], 3 if candidate["document_id"] in expected_docs else 0))
        for candidate in ranking[:10]
    ]
    ideal = sorted((int(value) for value in gold["graded_relevance"].values()), reverse=True)[:10]
    top = ranking[0] if ranking else None
    top_status = top["norm_status"] if top and top["document_id"] in expected_docs else None
    expected_statuses = {
        candidate["norm_status"]
        for candidate in pool["candidates"]
        if candidate["document_id"] in expected_docs
    }
    prohibited = set(gold["prohibited_document_ids"])
    top10 = ranking[:10]
    duplicate_groups = [candidate["duplicate_group"] for candidate in top10]
    return {
        "recall_at_10": 1.0 if any(relevant[:10]) else 0.0,
        "mrr": 0.0 if first is None else 1.0 / (first + 1),
        "ndcg_at_10": dcg(relevance) / max(dcg(ideal), float.fromhex("0x1.0p-52")) if ideal else 0.0,
        "citation_document_accuracy": 1.0 if top and top["document_id"] in expected_docs else 0.0,
        "expected_source_hit": 1.0 if any(relevant[:20]) else 0.0,
        "current_contamination": 1.0 if gold["status_scope"] == "current" and any(candidate["norm_status"] != "active" for candidate in top10) else 0.0,
        "expected_unknown_warning": "unknown" in expected_statuses,
        "predicted_unknown_warning": top_status == "unknown",
        "expected_repealed_warning": "repealed" in expected_statuses,
        "predicted_repealed_warning": top_status == "repealed",
        "injection_pass": (
            not run["no_answer"]
            and bool(top)
            and top["document_id"] in expected_docs
            and not any(candidate["document_id"] in prohibited for candidate in top10)
        ) if gold["intent"] == "prompt_injection_candidate" else None,
        "duplicate_quality": (
            any(relevant[:10]) and len(duplicate_groups) == len(set(duplicate_groups))
        ) if gold["intent"] == "duplicate_near_duplicate" else None,
        "no_answer_correct": bool(run["no_answer"]) != bool(gold["answerable"]),
    }


def binary_pr(rows: list[dict], expected_key: str, predicted_key: str) -> dict:
    true_positive = sum(row[expected_key] and row[predicted_key] for row in rows)
    predicted = sum(row[predicted_key] for row in rows)
    expected = sum(row[expected_key] for row in rows)
    return {
        "precision": true_positive / predicted if predicted else (1.0 if expected == 0 else 0.0),
        "recall": true_positive / expected if expected else 1.0,
        "support": expected,
        "predicted": predicted,
    }


def average(rows: list[dict], key: str) -> float:
    return sum(float(row[key]) for row in rows) / max(1, len(rows))


def bootstrap_difference(left: list[dict], right: list[dict], metric: str, rng: random.Random, iterations: int) -> dict:
    differences = []
    size = len(left)
    observed = average(left, metric) - average(right, metric)
    for _ in range(iterations):
        indexes = [rng.randrange(size) for _ in range(size)]
        differences.append(sum(left[index][metric] - right[index][metric] for index in indexes) / size)
    differences.sort()
    return {
        "observed_difference": observed,
        "bootstrap_mean_difference": sum(differences) / len(differences),
        "ci95": [differences[int(0.025 * iterations)], differences[min(iterations - 1, int(0.975 * iterations))]],
        "probability_difference_gt_zero": sum(value > 0 for value in differences) / iterations,
        "iterations": iterations,
    }


def mcnemar(left: list[dict], right: list[dict], metric: str) -> dict:
    left_only = sum(bool(a[metric]) and not bool(b[metric]) for a, b in zip(left, right))
    right_only = sum(not bool(a[metric]) and bool(b[metric]) for a, b in zip(left, right))
    n = left_only + right_only
    if n == 0:
        p_value = 1.0
    else:
        tail = sum(math.comb(n, index) for index in range(0, min(left_only, right_only) + 1)) / 2**n
        p_value = min(1.0, 2 * tail)
    return {"candidate_only_correct": left_only, "baseline_only_correct": right_only, "exact_two_sided_p": p_value}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--iterations", type=int, default=20000)
    args = parser.parse_args()

    gold = [row for row in jsonl(args.artifacts / "prompt19_2_frozen_gold.jsonl") if row["split"] == "test"]
    gold_by_id = {row["query_id"]: row for row in gold}
    pools = {row["query_id"]: row for row in jsonl(args.artifacts / "prompt19_2_candidate_pools.jsonl") if row["split"] == "test"}
    systems: dict[str, dict] = {}
    per_query: dict[str, list[dict]] = {}
    failures: list[dict] = []

    for name, filename in SYSTEM_FILES.items():
        result = json.loads((args.artifacts / filename).read_text(encoding="utf-8"))
        run_by_id = {run["query_id"]: run for run in result["runs"]}
        rows = []
        for gold_row in gold:
            run = run_by_id[gold_row["query_id"]]
            values = query_metrics(gold_row, run, pools[gold_row["query_id"]])
            row = {"query_id": gold_row["query_id"], "intent": gold_row["intent"], "scope": gold_row["status_scope"], **values}
            rows.append(row)
            reasons = []
            if gold_row["answerable"] and not values["recall_at_10"]:
                reasons.append("EXPECTED_DOCUMENT_MISSING_AT_10")
            if gold_row["answerable"] and not values["citation_document_accuracy"]:
                reasons.append("TOP1_CITATION_DOCUMENT_MISMATCH")
            if not values["no_answer_correct"]:
                reasons.append("NO_ANSWER_DECISION_ERROR")
            if values["current_contamination"]:
                reasons.append("CURRENT_STATUS_CONTAMINATION")
            if values["injection_pass"] is False:
                reasons.append("INJECTION_CASE_RANKING_FAILURE")
            if values["duplicate_quality"] is False:
                reasons.append("DUPLICATE_COLLAPSE_FAILURE")
            if reasons:
                failures.append({"system": name, "query_id": gold_row["query_id"], "intent": gold_row["intent"], "status_scope": gold_row["status_scope"], "reasons": reasons})

        answerable = [row for row in rows if gold_by_id[row["query_id"]]["answerable"]]
        injection = [row["injection_pass"] for row in rows if row["injection_pass"] is not None]
        duplicate = [row["duplicate_quality"] for row in rows if row["duplicate_quality"] is not None]
        unknown = binary_pr(rows, "expected_unknown_warning", "predicted_unknown_warning")
        repealed = binary_pr(rows, "expected_repealed_warning", "predicted_repealed_warning")
        metrics = result["metrics"]
        systems[name] = {
            "source_artifact": filename,
            "model": result.get("model"),
            "revision": result.get("revision"),
            "cross_encoder_weight": result.get("cross_encoder_weight"),
            "metrics": {
                **metrics,
                "expected_source_hit_rate": average(answerable, "expected_source_hit"),
                "unknown_warning": unknown,
                "repealed_warning": repealed,
                "prompt_injection_pass_rate": sum(bool(value) for value in injection) / max(1, len(injection)),
                "prompt_injection_cases": len(injection),
                "duplicate_ranking_quality": sum(bool(value) for value in duplicate) / max(1, len(duplicate)),
                "duplicate_cases": len(duplicate),
            },
        }
        per_query[name] = answerable

    rng = random.Random(1902)
    comparisons = {}
    for candidate in ("E1_GTE", "E2_BGE"):
        comparisons[f"{candidate}_vs_D"] = {
            metric: bootstrap_difference(per_query[candidate], per_query["D_LEGAL_SCORER"], metric, rng, args.iterations)
            for metric in ("recall_at_10", "mrr", "ndcg_at_10", "citation_document_accuracy")
        }
        comparisons[f"{candidate}_vs_D"]["citation_mcnemar"] = mcnemar(per_query[candidate], per_query["D_LEGAL_SCORER"], "citation_document_accuracy")

    gates = {
        "recall_at_10": {"operator": ">=", "threshold": 0.90},
        "mrr": {"operator": ">=", "threshold": 0.80},
        "ndcg_at_10": {"operator": ">=", "threshold": 0.85},
        "citation_document_accuracy": {"operator": "=", "threshold": 1.0},
        "current_law_contamination": {"operator": "=", "threshold": 0.0},
        "no_answer_false_positive_rate": {"operator": "<=", "threshold": 0.02},
        "prompt_injection_pass_rate": {"operator": "=", "threshold": 1.0},
        "latency_p95_ms": {"operator": "<=", "threshold": 1500.0},
    }
    for name, system in systems.items():
        values = system["metrics"]
        checks = {
            "recall_at_10": values["recall_at_10"] >= 0.90,
            "mrr": values["mrr"] >= 0.80,
            "ndcg_at_10": values["ndcg_at_10"] >= 0.85,
            "citation_document_accuracy": values["citation_document_accuracy"] == 1.0,
            "current_law_contamination": values["current_law_contamination"] == 0.0,
            "no_answer_false_positive_rate": values["no_answer_false_positive_rate"] <= 0.02,
            "prompt_injection_pass_rate": values["prompt_injection_pass_rate"] == 1.0,
            "latency_p95_ms": values["latency_ms"]["p95"] <= 1500.0,
            "unknown_warning_accuracy": values["unknown_warning"]["precision"] == 1.0 and values["unknown_warning"]["recall"] == 1.0,
            "repealed_warning_accuracy": values["repealed_warning"]["precision"] == 1.0 and values["repealed_warning"]["recall"] == 1.0,
            "cross_tenant_leakage": None,
        }
        system["gate_checks"] = checks
        system["all_measured_gates_pass"] = all(value for value in checks.values() if value is not None)
        system["release_gate_pass"] = False
        system["release_gate_blockers"] = [
            *(key for key, value in checks.items() if value is False),
            "cross_tenant_leakage_not_measurable_in_snapshot",
            "legal_review_pending",
        ]

    for candidate in ("E1_GTE", "E2_BGE"):
        comparison = comparisons[f"{candidate}_vs_D"]
        candidate_metrics = systems[candidate]["metrics"]
        baseline_metrics = systems["D_LEGAL_SCORER"]["metrics"]
        winner_checks = {
            "material_mrr_improvement": comparison["mrr"]["ci95"][0] > 0,
            "material_ndcg_improvement": comparison["ndcg_at_10"]["ci95"][0] > 0,
            "recall_within_tolerance": candidate_metrics["recall_at_10"] >= baseline_metrics["recall_at_10"] - 0.01,
            "no_answer_not_worse": candidate_metrics["no_answer_false_positive_rate"] <= baseline_metrics["no_answer_false_positive_rate"] and candidate_metrics["no_answer_false_negative_rate"] <= baseline_metrics["no_answer_false_negative_rate"],
            "citation_not_worse": candidate_metrics["citation_document_accuracy"] >= baseline_metrics["citation_document_accuracy"],
            "latency_within_budget": candidate_metrics["latency_ms"]["p95"] <= 1500.0,
        }
        systems[candidate]["winner_checks_vs_D"] = winner_checks
        systems[candidate]["release_gate_blockers"].extend(key for key, value in winner_checks.items() if not value)

    matrix = {
        "evidence_class": "PROVISIONAL_NON_EXPERT_FROZEN_TEST",
        "release_eligible": False,
        "dataset_status": "ENGINEERING_GOLD_PENDING_LEGAL_REVIEW",
        "test_query_count": len(gold),
        "test_answerable_count": sum(row["answerable"] for row in gold),
        "gates": gates,
        "systems": systems,
        "verdict": "GENERIC_RERANKERS_REJECTED — CUSTOM_ARMENIAN_LEGAL_RERANKER_REQUIRED — NO_PRODUCTION_WRITES",
    }
    statistics = {
        "seed": 1902,
        "paired_unit": "frozen test query",
        "answerable_query_count": len(per_query["D_LEGAL_SCORER"]),
        "bootstrap_iterations": args.iterations,
        "comparisons": comparisons,
        "test_used_for_weight_selection": False,
        "interpretation": "A 95% interval containing zero is not evidence of a material improvement.",
    }

    (args.artifacts / "prompt19_2_evaluation_matrix.json").write_text(json.dumps(matrix, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.artifacts / "prompt19_2_statistical_evidence.json").write_text(json.dumps(statistics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.artifacts / "prompt19_2_failed_queries.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in failures), encoding="utf-8")
    print(json.dumps({"systems": {name: value["metrics"] for name, value in systems.items()}, "failed_rows": len(failures), "comparisons": comparisons}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
