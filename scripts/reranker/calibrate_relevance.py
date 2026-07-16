from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def sigmoid(value: float) -> float:
    if value >= 0:
        z = math.exp(-value)
        return 1 / (1 + z)
    z = math.exp(value)
    return z / (1 + z)


def fit_logistic(rows: list[dict]) -> tuple[float, float]:
    weight = 0.0
    bias = 0.0
    for _ in range(6000):
        grad_weight = 0.0
        grad_bias = 0.0
        for row in rows:
            prediction = sigmoid(weight * row["support"] + bias)
            error = prediction - row["label"]
            grad_weight += error * row["support"]
            grad_bias += error
        scale = 0.08 / max(1, len(rows))
        weight -= scale * grad_weight
        bias -= scale * grad_bias
    return weight, bias


def fit_isotonic(rows: list[dict]) -> list[dict]:
    ordered = sorted(rows, key=lambda row: (row["support"], row["query_id"]))
    blocks: list[dict] = []
    for row in ordered:
        blocks.append({"low": row["support"], "high": row["support"], "sum": row["label"], "count": 1})
        while len(blocks) >= 2 and blocks[-2]["sum"] / blocks[-2]["count"] > blocks[-1]["sum"] / blocks[-1]["count"]:
            right = blocks.pop()
            left = blocks.pop()
            blocks.append({
                "low": left["low"],
                "high": right["high"],
                "sum": left["sum"] + right["sum"],
                "count": left["count"] + right["count"],
            })
    return [{**block, "probability": block["sum"] / block["count"]} for block in blocks]


def isotonic_predict(blocks: list[dict], value: float) -> float:
    nearest = min(blocks, key=lambda block: min(abs(value - block["low"]), abs(value - block["high"])))
    for block in blocks:
        if block["low"] <= value <= block["high"]:
            return block["probability"]
    return nearest["probability"]


def metrics(rows: list[dict], predictions: list[bool], probabilities: list[float]) -> dict:
    answerable = sum(row["label"] for row in rows)
    unanswerable = len(rows) - answerable
    false_negative = sum(row["label"] == 1 and not prediction for row, prediction in zip(rows, predictions))
    hallucination = sum(row["label"] == 0 and prediction for row, prediction in zip(rows, predictions))
    brier = sum((probability - row["label"]) ** 2 for row, probability in zip(rows, probabilities)) / max(1, len(rows))
    return {
        "query_count": len(rows),
        "answerable": answerable,
        "unanswerable": unanswerable,
        "no_answer_false_negative_rate": false_negative / max(1, answerable),
        "no_answer_hallucination_rate": hallucination / max(1, unanswerable),
        "brier_score": brier,
    }


def hard_blocked(row: dict) -> bool:
    return any(reason in {
        "STATUS_INELIGIBLE",
        "EXACT_LOOKUP_UNSUPPORTED",
        "CURRENT_SCOPE_ONLY_NONCURRENT_SUPPORT",
        "WEAK_RETRIEVAL_EVIDENCE",
        "CONTRADICTORY_EVIDENCE",
    } for reason in row["hard_reasons"])


def choose_cutoff(train: list[dict], dev: list[dict], probability) -> tuple[float, dict, dict]:
    trials = []
    for integer in range(0, 1001):
        cutoff = integer / 1000
        train_prob = [probability(row) for row in train]
        dev_prob = [probability(row) for row in dev]
        train_predictions = [p >= cutoff and not hard_blocked(row) for row, p in zip(train, train_prob)]
        dev_predictions = [p >= cutoff and not hard_blocked(row) for row, p in zip(dev, dev_prob)]
        train_metrics = metrics(train, train_predictions, train_prob)
        dev_metrics = metrics(dev, dev_predictions, dev_prob)
        if train_metrics["no_answer_hallucination_rate"] <= 0.02 and dev_metrics["no_answer_hallucination_rate"] <= 0.02:
            trials.append((cutoff, train_metrics, dev_metrics))
    if not trials:
        raise RuntimeError("no calibration cutoff satisfies the hallucination gate")
    trials.sort(key=lambda item: (
        item[2]["no_answer_false_negative_rate"],
        item[1]["no_answer_false_negative_rate"],
        -item[0],
    ))
    return trials[0]


def threshold_for_group(train: list[dict], field: str, value: str, fallback: float) -> float:
    group = [row for row in train if row[field] == value]
    if not group or not any(row["label"] == 0 for row in group) or not any(row["label"] == 1 for row in group):
        return fallback
    eligible = []
    for integer in range(200, 801):
        threshold = integer / 1000
        predictions = [row["support"] >= threshold and not hard_blocked(row) for row in group]
        values = metrics(group, predictions, [row["support"] for row in group])
        if values["no_answer_hallucination_rate"] <= 0.02:
            eligible.append((values["no_answer_false_negative_rate"], -threshold, threshold))
    return sorted(eligible)[0][2] if eligible else fallback


def method_result(name: str, train: list[dict], dev: list[dict], probability, parameters: dict) -> dict:
    cutoff, train_metrics, dev_metrics = choose_cutoff(train, dev, probability)
    return {
        "method": name,
        "parameters": parameters,
        "decision_cutoff": cutoff,
        "train": train_metrics,
        "dev": dev_metrics,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gold", type=Path, required=True)
    parser.add_argument("--train", type=Path, required=True)
    parser.add_argument("--dev", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    gold = {row["query_id"]: row for row in read_jsonl(args.gold)}

    def load_runs(path: Path) -> list[dict]:
        result = json.loads(path.read_text(encoding="utf-8"))
        rows = []
        for run in result["runs"]:
            item = gold[run["query_id"]]
            rows.append({
                "query_id": run["query_id"],
                "support": float(run.get("support_score", 0)),
                "label": 1 if item["answerable"] else 0,
                "intent": item["intent"],
                "scope": item["status_scope"],
                "hard_reasons": [reason for reason in run.get("no_answer_reasons", []) if reason not in {
                    "CALIBRATED_SUPPORT_BELOW_THRESHOLD",
                    "RERANKER_UNAVAILABLE_LOW_DETERMINISTIC_SUPPORT",
                }],
            })
        return rows

    train = load_runs(args.train)
    dev = load_runs(args.dev)

    threshold_cutoff, threshold_train, threshold_dev = choose_cutoff(train, dev, lambda row: row["support"])
    methods = [{
        "method": "threshold_grid_search",
        "parameters": {"support_threshold": threshold_cutoff},
        "decision_cutoff": threshold_cutoff,
        "train": threshold_train,
        "dev": threshold_dev,
    }]

    weight, bias = fit_logistic(train)
    methods.append(method_result("logistic_calibration", train, dev, lambda row: sigmoid(weight * row["support"] + bias), {"weight": weight, "bias": bias}))

    blocks = fit_isotonic(train)
    methods.append(method_result("isotonic_regression", train, dev, lambda row: isotonic_predict(blocks, row["support"]), {"blocks": blocks}))

    for field, name in (("intent", "intent_specific_thresholds"), ("scope", "scope_specific_thresholds")):
        groups = sorted({row[field] for row in train + dev})
        thresholds = {group: threshold_for_group(train, field, group, threshold_cutoff) for group in groups}
        probability = lambda row, values=thresholds, key=field: 1.0 if row["support"] >= values[row[key]] else 0.0
        methods.append(method_result(name, train, dev, probability, {"thresholds": thresholds}))

    complexity = {
        "threshold_grid_search": 0,
        "logistic_calibration": 1,
        "isotonic_regression": 2,
        "scope_specific_thresholds": 3,
        "intent_specific_thresholds": 4,
    }
    selected = sorted(methods, key=lambda item: (
        item["dev"]["no_answer_hallucination_rate"] > 0.02,
        item["dev"]["no_answer_false_negative_rate"],
        item["train"]["no_answer_false_negative_rate"],
        complexity[item["method"]],
    ))[0]
    output = {
        "evidence_class": "PROVISIONAL_NON_EXPERT_TRAIN_DEV_ONLY",
        "release_eligible": False,
        "test_split_used_for_tuning": False,
        "independent_signals": [
            "retrieval_relevance",
            "status_eligibility",
            "authority_quality",
            "temporal_validity",
            "evidence_sufficiency",
            "citation_support",
            "contradiction_state",
        ],
        "methods": methods,
        "selected_method": selected["method"],
        "selected_parameters": selected["parameters"],
        "selected_train_metrics": selected["train"],
        "selected_dev_metrics": selected["dev"],
        "selection_rule": "hallucination<=0.02 on train/dev, then minimum dev/train false-no-answer, then lowest complexity",
    }
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"selected_method": output["selected_method"], "selected_parameters": output["selected_parameters"], "dev": output["selected_dev_metrics"]}, indent=2))


if __name__ == "__main__":
    main()
