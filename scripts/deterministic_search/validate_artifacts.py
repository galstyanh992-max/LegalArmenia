#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    root, output, manifest_path = args.root, args.output, args.manifest
    a = root / "AUDIT_REPORTS" / "artifacts"
    baseline = load(a / "prompt19_4_baseline.json")
    evaluation = load(a / "prompt19_4_evaluation_metrics.json")
    live = load(a / "prompt19_4_live_verification.json")
    review = load(a / "prompt19_4_legal_review_status.json")
    test_hash = hashlib.sha256((a / "prompt19_2_gold_test.jsonl").read_bytes()).hexdigest()
    checks = {
        "parent": baseline["parent_hash"] == "ecbe09a2c84a2c7ad57ff2b110c8a959da6c5c6b",
        "frozen_test_unchanged": test_hash == baseline["frozen_dataset"]["test_file_sha256"],
        "test_not_used_for_tuning": load(a / "prompt19_4_scorer_config.json")["test_used_for_tuning"] is False,
        "metric_only": load(a / "prompt19_4_scorer_config.json")["semantic_route"] == "Metric-AI only",
        "qwen_absent": load(a / "prompt19_4_scorer_config.json")["qwen_used"] is False,
        "ml_reranker_absent": load(a / "prompt19_4_scorer_config.json")["ml_reranker_used"] is False,
        "citation_gate_truthful": evaluation["systems"]["B_deterministic_v2"]["citation_document_accuracy"] < 1,
        "injection_gate_truthful": evaluation["systems"]["B_deterministic_v2"]["injection_pass_rate"] < 1,
        "live_rpc_failure_recorded": live["postgrest_rpc"]["rpc_found_in_live_schema_cache"] is False,
        "legal_review_truthful": review["legal_review_status"] == "ENGINEERING_GOLD_PENDING_LEGAL_REVIEW" and review["approval_fabricated"] is False,
        "production_untouched": baseline["production_writes"] == 0 and baseline["production_deployments"] == 0,
        "reports_65_75": all((root / "AUDIT_REPORTS" / f"{n}_{name}.md").exists() for n, name in [
            (65,"CITATION_FAILURE_ANALYSIS"),(66,"CITATION_METADATA_AUDIT"),(67,"ARMENIAN_PROVISION_PARSER"),(68,"IDENTIFIER_RETRIEVAL_REPAIR"),(69,"DETERMINISTIC_SCORER_V2"),(70,"INJECTION_RANKING_DEFENSE"),(71,"NO_ANSWER_V2"),(72,"DETERMINISTIC_SEARCH_EVALUATION"),(73,"LEGAL_REVIEW_OPERATOR_GUIDE"),(74,"TENANT_STAGING_VERIFICATION"),(75,"DETERMINISTIC_SEARCH_PRODUCTION_PLAN")]),
    }
    excluded = {output.resolve(), manifest_path.resolve()}
    files = sorted(path for path in a.rglob("prompt19_4*") if path.is_file() and path.resolve() not in excluded)
    manifest = {str(path.relative_to(root)).replace("\\", "/"): {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size} for path in files}
    manifest_path.write_text(json.dumps({"file_count": len(manifest), "files": manifest}, indent=2) + "\n", encoding="utf-8")
    result = {"passed": all(checks.values()), "check_count": len(checks), "failed_checks": [k for k,v in checks.items() if not v], "checks": checks}
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if not result["passed"]: raise SystemExit(1)


if __name__ == "__main__":
    main()
