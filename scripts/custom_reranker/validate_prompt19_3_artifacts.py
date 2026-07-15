#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    root = args.root
    artifacts = root / "AUDIT_REPORTS" / "artifacts"
    baseline = load(artifacts / "prompt19_3_baseline.json")
    expanded = load(
        artifacts / "prompt19_3_training_data" / "expanded_dataset_manifest.json"
    )
    leakage = load(artifacts / "prompt19_3_training_data" / "leakage_report.json")
    review = load(artifacts / "prompt19_3_review" / "agreement_metrics.json")
    evaluation = load(artifacts / "prompt19_3_custom_evaluation.json")
    tenant = load(artifacts / "prompt19_3_tenant_isolation.json")
    models = load(artifacts / "prompt19_3_model_manifests.json")
    checks = {
        "parent_commit": baseline["parent_prompt19_2_commit"]
        == "35ec38d776295ddae35fcd801008bd3482596936",
        "frozen_test_hash": hashlib.sha256(
            (artifacts / "prompt19_2_gold_test.jsonl").read_bytes()
        ).hexdigest()
        == baseline["frozen_dataset"]["test_file_sha256"],
        "expanded_query_minimum": expanded["query_count"] >= 2000,
        "frozen_test_not_expanded": expanded["frozen_test_examples_added"] == 0,
        "leakage": leakage["passed"],
        "legal_review_truthful": review["legal_gold_status"]
        == "ENGINEERING_GOLD_PENDING_LEGAL_REVIEW"
        and not review["adjudication_complete"],
        "three_base_encoders": len(models["models"]) == 3,
        "qwen_absent": models["custom_head"]["qwen_used"] is False,
        "weights_not_committed": not models["oversized_model_weights_committed"],
        "test_not_used_for_selection": evaluation["test_used_for_selection"] is False,
        "custom_rejected_truthfully": evaluation["verdict"]
        == "CUSTOM_RERANKER_REJECTED",
        "citation_gate_truthful": evaluation["custom_f_test"][
            "citation_document_accuracy"
        ]
        < 1,
        "injection_gate_truthful": evaluation["custom_f_test"][
            "prompt_injection_pass_rate"
        ]
        < 1,
        "tenant_fixture_passed": tenant["passed"]
        and tenant["cross_tenant_leakage"] == 0,
        "production_tenant_not_overclaimed": tenant["production_rls_measured"] is False,
        "production_writes_zero": baseline["production_writes"] == 0,
        "production_deployments_zero": baseline["production_deployments"] == 0,
        "reports_53_64": all(
            (root / "AUDIT_REPORTS" / f"{number}_{name}.md").exists()
            for number, name in [
                (53, "LEGAL_REVIEW_PROTOCOL"),
                (54, "GOLD_DATASET_LEGAL_REVIEW"),
                (55, "HARD_NEGATIVE_MINING"),
                (56, "ARMENIAN_TOKENIZATION_AUDIT"),
                (57, "CUSTOM_RERANKER_TRAINING"),
                (58, "CUSTOM_RERANKER_EVALUATION"),
                (59, "CITATION_ACCURACY_REPAIR"),
                (60, "INJECTION_REPAIR"),
                (61, "NO_ANSWER_RECALIBRATION"),
                (62, "TENANT_STAGING_RESULTS"),
                (63, "CUSTOM_RERANKER_PERFORMANCE"),
                (64, "CUSTOM_RERANKER_PRODUCTION_PLAN"),
            ]
        ),
    }
    excluded = {args.output.resolve(), args.manifest.resolve()}
    files = sorted(
        path
        for path in artifacts.rglob("prompt19_3*")
        if path.is_file() and path.resolve() not in excluded
    )
    manifest = {
        str(path.relative_to(root)).replace("\\", "/"): {
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "bytes": path.stat().st_size,
        }
        for path in files
    }
    args.manifest.write_text(
        json.dumps({"file_count": len(manifest), "files": manifest}, indent=2) + "\n",
        encoding="utf-8",
    )
    result = {
        "passed": all(checks.values()),
        "check_count": len(checks),
        "failed_checks": [key for key, value in checks.items() if not value],
        "checks": checks,
    }
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if not result["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
