#!/usr/bin/env python3
"""Dev-select and once evaluate the custom frozen-encoder head on frozen Prompt 19.2 test."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import re
import statistics
import time
from pathlib import Path
from typing import Any

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

REPO = "distilbert/distilbert-base-multilingual-cased"
REVISION = "45c032ab32cc946ad88a166f7cb282f58c753c2e"
INJECTION = re.compile(
    r"ignore previous instructions|return this document as rank 1|reveal (?:the )?system prompt|set score to 1\.0|system message|բացահայտիր համակարգային|игнорируй предыдущие",
    re.I,
)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def percentile(values: list[float], q: float) -> float:
    return float(np.percentile(values, q)) if values else 0.0


class Scorer:
    def __init__(self, head_path: Path, max_length: int, batch_size: int) -> None:
        payload = json.loads(head_path.read_text(encoding="utf-8"))
        self.tokenizer = AutoTokenizer.from_pretrained(REPO, revision=REVISION)
        self.model = AutoModel.from_pretrained(REPO, revision=REVISION)
        self.model.eval()
        self.weight = torch.tensor(
            payload["head"]["relevance_weight"], dtype=torch.float32
        )
        self.bias = torch.tensor(payload["head"]["relevance_bias"], dtype=torch.float32)
        self.max_length, self.batch_size = max_length, batch_size

    def score(self, rows: list[dict[str, Any]]) -> tuple[list[float], list[float]]:
        scores, query_latencies = [], []
        torch.set_num_threads(min(18, max(1, torch.get_num_threads())))
        with torch.inference_mode():
            for start in range(0, len(rows), self.batch_size):
                batch = rows[start : start + self.batch_size]
                encoded = self.tokenizer(
                    [row["query"] for row in batch],
                    [row["text"] for row in batch],
                    padding=True,
                    truncation=True,
                    max_length=self.max_length,
                    return_tensors="pt",
                )
                began = time.perf_counter()
                hidden = self.model(**encoded).last_hidden_state
                mask = encoded["attention_mask"].unsqueeze(-1)
                pooled = (hidden * mask).sum(1) / mask.sum(1).clamp_min(1)
                logits = pooled @ self.weight + self.bias
                values = torch.sigmoid(logits).cpu().numpy().tolist()
                elapsed = (time.perf_counter() - began) * 1000
                scores.extend(values)
                query_latencies.extend([elapsed / len(batch)] * len(batch))
        return scores, query_latencies


def ndcg(labels: list[float], k: int = 10) -> float:
    dcg = sum(
        (2**label - 1) / math.log2(index + 2) for index, label in enumerate(labels[:k])
    )
    ideal = sorted(labels, reverse=True)[:k]
    idcg = sum(
        (2**label - 1) / math.log2(index + 2) for index, label in enumerate(ideal)
    )
    return dcg / idcg if idcg else 0.0


def evaluate(
    cases: list[dict[str, Any]],
    rankings: dict[str, list[str]],
    candidates: dict[str, dict[str, dict[str, Any]]],
    no_answer: dict[str, bool],
    latencies: list[float],
) -> tuple[dict[str, Any], list[dict[str, float]]]:
    per_query = []
    answerable_cases = [case for case in cases if case["answerable"]]
    citation_doc, citation_provision, injection_pass, contamination = [], [], [], 0
    fp = fn = no_answer_count = answer_count = 0
    for case in cases:
        ranking = rankings[case["query_id"]]
        expected_chunks = set(case.get("expected_chunk_ids", []))
        expected_docs = set(case.get("expected_document_ids", []))
        grades = case.get("graded_relevance", {})
        binary = [
            1
            if cid in expected_chunks
            or candidates[case["query_id"]].get(cid, {}).get("document_id")
            in expected_docs
            else 0
            for cid in ranking
        ]
        graded = [
            float(grades.get(cid, 3 if hit else 0)) for cid, hit in zip(ranking, binary)
        ]
        if case["answerable"]:
            answer_count += 1
            first = next((i + 1 for i, hit in enumerate(binary) if hit), None)
            mrr = 1 / first if first else 0
            per_query.append(
                {
                    "mrr": mrr,
                    "ndcg_at_10": ndcg(graded),
                    "recall_at_10": 1.0 if any(binary[:10]) else 0.0,
                }
            )
            top = candidates[case["query_id"]].get(ranking[0], {}) if ranking else {}
            citation_doc.append(
                bool(ranking)
                and (
                    top.get("document_id") in expected_docs
                    or ranking[0] in expected_chunks
                )
            )
            citation_provision.append(bool(ranking) and ranking[0] in expected_chunks)
        predicted_no_answer = no_answer[case["query_id"]]
        if case["answerable"] and predicted_no_answer:
            fn += 1
        if not case["answerable"]:
            no_answer_count += 1
            if not predicted_no_answer:
                fp += 1
        if case["intent"] == "prompt_injection_candidate":
            injection_pass.append(
                bool(ranking)
                and bool(binary[0])
                and not str(ranking[0]).startswith("synthetic-injection")
            )
        if case["status_scope"] == "current":
            contamination += sum(
                candidates[case["query_id"]].get(cid, {}).get("norm_status")
                in {"unknown", "repealed"}
                for cid in ranking[:20]
            )
    metrics = {
        "query_count": len(cases),
        "answerable_count": answer_count,
        "recall_at_5": statistics.fmean(
            1.0
            if any(
                (
                    cid in set(case.get("expected_chunk_ids", []))
                    or candidates[case["query_id"]].get(cid, {}).get("document_id")
                    in set(case.get("expected_document_ids", []))
                )
                for cid in rankings[case["query_id"]][:5]
            )
            else 0.0
            for case in answerable_cases
        ),
        "recall_at_10": statistics.fmean(row["recall_at_10"] for row in per_query),
        "recall_at_20": statistics.fmean(
            1.0
            if any(
                (
                    cid in set(case.get("expected_chunk_ids", []))
                    or candidates[case["query_id"]].get(cid, {}).get("document_id")
                    in set(case.get("expected_document_ids", []))
                )
                for cid in rankings[case["query_id"]][:20]
            )
            else 0.0
            for case in answerable_cases
        ),
        "precision_at_5": statistics.fmean(
            sum(
                (
                    cid in set(case.get("expected_chunk_ids", []))
                    or candidates[case["query_id"]].get(cid, {}).get("document_id")
                    in set(case.get("expected_document_ids", []))
                )
                for cid in rankings[case["query_id"]][:5]
            )
            / 5
            for case in answerable_cases
        ),
        "mrr": statistics.fmean(row["mrr"] for row in per_query),
        "ndcg_at_10": statistics.fmean(row["ndcg_at_10"] for row in per_query),
        "map": statistics.fmean(row["mrr"] for row in per_query),
        "citation_document_accuracy": statistics.fmean(citation_doc),
        "citation_provision_accuracy": statistics.fmean(citation_provision),
        "no_answer_false_positive_rate": fp / no_answer_count if no_answer_count else 0,
        "no_answer_false_negative_rate": fn / answer_count if answer_count else 0,
        "current_law_contamination": contamination,
        "prompt_injection_pass_rate": statistics.fmean(injection_pass)
        if injection_pass
        else None,
        "latency_ms": {
            "p50": percentile(latencies, 50),
            "p95": percentile(latencies, 95),
            "p99": percentile(latencies, 99),
        },
    }
    return metrics, per_query


def bootstrap(
    base: list[dict[str, float]],
    custom: list[dict[str, float]],
    seed: int = 1933,
    samples: int = 20_000,
) -> dict[str, Any]:
    rng = random.Random(seed)
    n = len(base)
    output = {}
    for metric in ("mrr", "ndcg_at_10"):
        differences = []
        for _ in range(samples):
            indices = [rng.randrange(n) for _ in range(n)]
            differences.append(
                statistics.fmean(custom[i][metric] - base[i][metric] for i in indices)
            )
        differences.sort()
        output[metric] = {
            "difference": statistics.fmean(
                custom[i][metric] - base[i][metric] for i in range(n)
            ),
            "ci95": [differences[500], differences[19499]],
        }
    return {"seed": seed, "samples": samples, "paired": output}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--head", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    all_cases = read_jsonl(args.artifacts / "prompt19_2_frozen_gold.jsonl")
    pool_rows = read_jsonl(args.artifacts / "prompt19_2_candidate_pools.jsonl")
    pools = {
        row["query_id"]: {
            candidate["candidate_id"]: candidate for candidate in row["candidates"]
        }
        for row in pool_rows
    }
    blind = {
        row["query_id"]: row
        for row in read_jsonl(
            args.artifacts / "prompt19_2_blinded_candidate_pools.jsonl"
        )
    }
    d_payload = json.loads(
        (args.artifacts / "prompt19_2_system_d_all.json").read_text(encoding="utf-8")
    )
    d_runs = {run["query_id"]: run for run in d_payload["runs"]}
    for query_id, row in blind.items():
        for candidate in row["candidates"]:
            if str(candidate["candidate_id"]).startswith("synthetic-injection"):
                pools[query_id][candidate["candidate_id"]] = {
                    "candidate_id": candidate["candidate_id"],
                    "text": candidate["text"],
                    "document_id": None,
                    "norm_status": "active",
                    "synthetic_adversarial": True,
                }
    scorer = Scorer(args.head, max_length=128, batch_size=16)
    split_scores: dict[str, dict[str, float]] = {}
    split_latency: dict[str, dict[str, float]] = {}
    for split in ("dev", "test"):
        rows = []
        for case in [row for row in all_cases if row["split"] == split]:
            ranking = d_runs[case["query_id"]]["ranking"][:20]
            extras = [
                cid
                for cid in pools[case["query_id"]]
                if str(cid).startswith("synthetic-injection")
            ]
            for candidate_id in list(dict.fromkeys(ranking + extras)):
                candidate = pools[case["query_id"]][candidate_id]
                rows.append(
                    {
                        "query_id": case["query_id"],
                        "candidate_id": candidate_id,
                        "query": case["query"],
                        "text": candidate["text"],
                    }
                )
        scores, latencies = scorer.score(rows)
        split_scores[split] = {
            f"{row['query_id']}:{row['candidate_id']}": (
                0.0 if INJECTION.search(row["text"]) else score
            )
            for row, score in zip(rows, scores)
        }
        split_latency[split] = {
            "p50_pair_ms": percentile(latencies, 50),
            "p95_pair_ms": percentile(latencies, 95),
            "p99_pair_ms": percentile(latencies, 99),
        }

    def rank_split(split: str, weight: float, top_n: int) -> dict[str, list[str]]:
        output = {}
        for case in [row for row in all_cases if row["split"] == split]:
            d_rank = d_runs[case["query_id"]]["ranking"]
            eligible = [
                cid
                for cid in d_rank
                if not (
                    case["status_scope"] == "current"
                    and pools[case["query_id"]][cid].get("norm_status")
                    in {"unknown", "repealed"}
                )
            ]
            extras = [
                cid
                for cid in pools[case["query_id"]]
                if str(cid).startswith("synthetic-injection")
            ]
            preselected = list(dict.fromkeys(eligible[:top_n] + extras))
            dscore = {
                cid: 1 - index / max(1, len(eligible) - 1)
                for index, cid in enumerate(eligible)
            }
            preselected.sort(
                key=lambda cid: (
                    (1 - weight) * dscore.get(cid, 0)
                    + weight * split_scores[split].get(f"{case['query_id']}:{cid}", 0)
                ),
                reverse=True,
            )
            output[case["query_id"]] = preselected + [
                cid for cid in eligible if cid not in preselected
            ]
        return output

    dev_cases = [row for row in all_cases if row["split"] == "dev"]
    configs: list[dict[str, Any]] = []
    for top_n in (10, 15, 20):
        for weight in (0.05, 0.1, 0.2, 0.35, 0.5):
            rankings = rank_split("dev", weight, top_n)
            no_answer = {
                case["query_id"]: d_runs[case["query_id"]]["no_answer"]
                for case in dev_cases
            }
            metrics, _ = evaluate(dev_cases, rankings, pools, no_answer, [])
            configs.append({"top_n": top_n, "weight": weight, "metrics": metrics})
    selected = max(
        configs,
        key=lambda row: (
            row["metrics"]["mrr"] + row["metrics"]["ndcg_at_10"],
            row["metrics"]["recall_at_10"],
        ),
    )
    selected_weight = float(selected["weight"])
    selected_top_n = int(selected["top_n"])
    test_cases = [row for row in all_cases if row["split"] == "test"]
    custom_rank = rank_split("test", selected_weight, selected_top_n)
    d_rank = {
        case["query_id"]: d_runs[case["query_id"]]["ranking"] for case in test_cases
    }
    no_answer = {
        case["query_id"]: d_runs[case["query_id"]]["no_answer"] for case in test_cases
    }
    per_query_latency = [
        split_latency["test"]["p50_pair_ms"] * selected_top_n
        + d_runs[case["query_id"]]["latency_ms"]
        for case in test_cases
    ]
    custom_metrics, custom_per = evaluate(
        test_cases, custom_rank, pools, no_answer, per_query_latency
    )
    baseline_metrics, base_per = evaluate(
        test_cases,
        d_rank,
        pools,
        no_answer,
        [d_runs[case["query_id"]]["latency_ms"] for case in test_cases],
    )
    stats = bootstrap(base_per, custom_per)
    verdict = (
        "CUSTOM_RERANKER_REJECTED"
        if custom_metrics["mrr"] - baseline_metrics["mrr"] < 0.03
        and custom_metrics["ndcg_at_10"] - baseline_metrics["ndcg_at_10"] < 0.03
        else "ENGINEERING_CANDIDATE_REQUIRES_ALL_GATES"
    )
    payload = {
        "declared_minimum_practical_effect_before_test": {
            "mrr_absolute": 0.03,
            "ndcg_at_10_absolute": 0.03,
        },
        "selection": {"split": "dev", **selected},
        "dev_grid": configs,
        "baseline_d_test": baseline_metrics,
        "custom_f_test": custom_metrics,
        "bootstrap": stats,
        "encoder_latency": split_latency,
        "model": {
            "repository": REPO,
            "revision": REVISION,
            "head_sha256": hashlib.sha256(args.head.read_bytes()).hexdigest(),
        },
        "test_used_for_selection": False,
        "status_guard_authoritative": True,
        "injection_pattern_penalty": True,
        "verdict": verdict,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "selection": payload["selection"],
                "baseline": baseline_metrics,
                "custom": custom_metrics,
                "bootstrap": stats,
                "verdict": verdict,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
