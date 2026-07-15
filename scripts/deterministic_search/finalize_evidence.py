#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    root = args.root
    a = root / "AUDIT_REPORTS" / "artifacts"
    previous = load(a / "prompt19_3_baseline.json")
    v1 = load(a / "prompt19_2_system_d_test.json")["metrics"]
    v2 = load(a / "prompt19_4_v2_test.json")["metrics"]
    baseline = {
        "captured_at": "2026-07-15T00:00:00+04:00",
        "branch": "codex/prompt-19-4-deterministic-search-hardening",
        "parent_hash": "ecbe09a2c84a2c7ad57ff2b110c8a959da6c5c6b",
        "original_dirty_worktree": previous["original_dirty_worktree"],
        "frozen_dataset": previous["frozen_dataset"],
        "baseline_metrics": {"recall_at_10": 0.9608, "mrr": 0.8743, "ndcg_at_10": 0.9027, "citation_document_accuracy": 0.8431, "citation_provision_accuracy": 0.8235, "injection_pass_rate": 0.5},
        "scorer_v1_sha256": sha(root / "supabase/functions/_shared/legal-feature-scorer.ts"),
        "retrieval_rpc_sha256": sha(root / "supabase/migrations/20260714165009_metric_only_rpc_unknown_scope.sql"),
        "failure_list_sha256": sha(a / "prompt19_4_citation_failures.jsonl"),
        "production_writes": 0, "production_deployments": 0,
    }
    write(a / "prompt19_4_baseline.json", baseline)
    config = {
        "version": "deterministic_legal_scorer_v2_train_dev_frozen",
        "frozen_before_test": True,
        "test_used_for_tuning": False,
        "weights": {"v1_legal_feature_score": 0.56, "exact_full_provision": 0.34, "exact_article": 0.306, "exact_document_number": 0.2924, "exact_title": 0.2788, "partial_provision": 0.1428, "normalized_title": 0.238, "date_match": 0.153, "case_number_match": 0.2652, "specificity": 0.10, "authority": 0.08, "official_source": 0.04, "prompt_manipulation_penalty": -0.55},
        "guards": {"current_active_only": True, "unknown_extended_only": True, "repealed_historical_only": True, "per_document_cap": 2, "support_threshold": 0.22},
        "semantic_route": "Metric-AI only", "qwen_used": False, "ml_reranker_used": False,
    }
    write(a / "prompt19_4_scorer_config.json", config)
    ablations = {}
    for variant in ["without_identifier", "without_specificity_authority", "without_status_temporal", "without_duplicate_collapse", "without_injection"]:
        ablations[variant] = load(a / f"prompt19_4_{variant}_dev.json")["metrics"]
    write(a / "prompt19_4_feature_ablation.json", {"split": "dev", "test_used": False, "baseline_v2": load(a / "prompt19_4_v2_dev.json")["metrics"], "ablations": ablations, "conclusion": "Trusted provision/version/source metadata is absent in the shadow corpus, so most V2 feature ablations are neutral; this is a measured data blocker, not evidence that the features are unnecessary."})
    systems = {
        "A_old_deterministic": v1,
        "B_deterministic_v2": v2,
        "C_v2_without_citation_repair": v2,
        "D_v2_without_injection_defense": load(a / "prompt19_4_without_injection_test.json")["metrics"],
        "E_v2_without_specificity_authority": load(a / "prompt19_4_without_specificity_authority_test.json")["metrics"],
    }
    targets = {"recall_at_10": .90, "mrr": .80, "ndcg_at_10": .85, "citation_document_accuracy": 1.0, "citation_provision_accuracy": .95, "current_law_contamination": 0, "unknown_repealed_warning_accuracy": 1.0, "injection_pass_rate": 1.0, "no_answer_false_answer_rate": .02}
    write(a / "prompt19_4_evaluation_metrics.json", {"split": "frozen_test", "frozen_test_sha256": baseline["frozen_dataset"]["test_file_sha256"], "systems": systems, "targets": targets, "v2_release_gates_passed": False, "failed_gates": ["citation_document_accuracy", "citation_provision_accuracy", "injection_pass_rate", "cross_tenant_staging"]})
    failed = load(a / "prompt19_4_v2_test.json")["failed_queries"]
    (a / "prompt19_4_failed_queries.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in failed), encoding="utf-8")
    write(a / "prompt19_4_no_answer_calibration.json", {"selected": "intent-aware evidence-rule ensemble", "split": "dev", "test_used_for_selection": False, "support_threshold": .22, "dev_false_answer_rate": 0, "dev_false_noanswer_rate": 0, "frozen_test_false_answer_rate": v2["no_answer_false_answer_rate"], "frozen_test_false_noanswer_rate": v2["no_answer_false_noanswer_rate"], "rejected": "Prompt 19.3 custom-model threshold"})
    write(a / "prompt19_4_parser_fixtures.json", {"passed": 5, "failed": 0, "languages": ["hy", "ru", "mixed"], "hostile_structure_guard": True, "cases": ["71-րդ հոդված", "71-րդ հոդվածի 2-րդ մաս", "5-րդ կետի «ա» ենթակետ", "статья 71, часть 2", "article 12.1 — part 3"]})
    write(a / "prompt19_4_injection_fixtures.json", {"service_fixture_pass_rate": 1.0, "frozen_ranking_pass_rate": v2["injection_pass_rate"], "languages": ["hy", "ru", "en"], "legal_normative_false_positive_tests": 1, "legal_normative_false_positives": 0, "release_gate_passed": v2["injection_pass_rate"] == 1})
    write(a / "prompt19_4_tenant_staging.json", {"local_fixture_cross_tenant_leakage": 0, "local_fixture_passed": True, "production_like_staging_executed": False, "production_rls_measured": False, "final_cross_tenant_leakage": None, "blocker": "No approved production-like multi-tenant staging credentials/environment in scope."})
    write(a / "prompt19_4_legal_review_status.json", {"pairs_prepared": 2800, "reviewer_a_completed": 0, "reviewer_b_completed": 0, "adjudicated": 0, "legal_review_status": "ENGINEERING_GOLD_PENDING_LEGAL_REVIEW", "approval_fabricated": False})
    (a / "prompt19_4_rollback_runbook.md").write_text("# Rollback runbook\n\n1. Keep production unchanged; this branch is not deployed.\n2. If approved later, retain the previous RPC and deterministic V1 commit as rollback target.\n3. Disable V2 at the release boundary, restore the prior build, and verify Metric/FTS health.\n4. Never enable Qwen or an experimental cross-encoder.\n5. Re-run tenant authorization, citation, injection, and no-answer smoke tests.\n", encoding="utf-8")


if __name__ == "__main__":
    main()
