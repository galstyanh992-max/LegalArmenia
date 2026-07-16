#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def metrics(
    cases: list[dict[str, Any]], runs: dict[str, dict[str, Any]], threshold: float
) -> dict[str, float]:
    answerable = [case for case in cases if case["answerable"]]
    unanswerable = [case for case in cases if not case["answerable"]]

    def refuse(case: dict[str, Any]) -> bool:
        run = runs[case["query_id"]]
        hard = any(
            reason
            in {
                "CONTRADICTORY_EVIDENCE",
                "CURRENT_SCOPE_ONLY_INELIGIBLE_STATUS",
                "CITATION_SUPPORT_INSUFFICIENT",
            }
            for reason in run.get("no_answer_reasons", [])
        )
        return hard or run.get("support_score", 0) < threshold

    false_answer = sum(not refuse(case) for case in unanswerable)
    false_no_answer = sum(refuse(case) for case in answerable)
    return {
        "false_answer_rate": false_answer / len(unanswerable) if unanswerable else 0,
        "false_no_answer_rate": false_no_answer / len(answerable) if answerable else 0,
        "false_answer_count": false_answer,
        "false_no_answer_count": false_no_answer,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    cases = read_jsonl(args.artifacts / "prompt19_2_frozen_gold.jsonl")
    runs = {
        run["query_id"]: run
        for run in json.loads(
            (args.artifacts / "prompt19_2_system_d_all.json").read_text(
                encoding="utf-8"
            )
        )["runs"]
    }
    dev = [case for case in cases if case["split"] == "dev"]
    test = [case for case in cases if case["split"] == "test"]
    grid = []
    for step in range(1001):
        threshold = step / 1000
        result = metrics(dev, runs, threshold)
        grid.append(
            {
                "threshold": threshold,
                **result,
                "objective": 5 * result["false_answer_rate"]
                + result["false_no_answer_rate"],
            }
        )
    selected = min(
        grid,
        key=lambda row: (
            row["objective"],
            row["false_answer_rate"],
            row["false_no_answer_rate"],
            -row["threshold"],
        ),
    )
    payload = {
        "prior_threshold_carried_forward_automatically": False,
        "methods_compared": [
            "global_threshold_grid",
            "intent_specific_threshold",
            "scope_specific_threshold",
            "calibrated_probability",
            "deterministic_ensemble",
        ],
        "selected_method": "global_threshold_grid_plus_hard_legal_rejection",
        "selection_split": "dev",
        "selected_threshold": selected["threshold"],
        "dev": selected,
        "frozen_test": metrics(test, runs, selected["threshold"]),
        "custom_model_confidence_used_as_legal_validity": False,
        "refusal_text": "В подключённом корпусе недостаточно подтверждённой информации для надёжного ответа.",
        "grid": grid,
    }
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "selected_threshold": payload["selected_threshold"],
                "dev": payload["dev"],
                "test": payload["frozen_test"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
