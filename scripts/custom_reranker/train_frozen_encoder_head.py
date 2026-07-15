#!/usr/bin/env python3
"""Train deterministic multi-head Armenian legal reranker heads on frozen encoder embeddings."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn
from transformers import AutoModel, AutoTokenizer

REPO = "distilbert/distilbert-base-multilingual-cased"
REVISION = "45c032ab32cc946ad88a166f7cb282f58c753c2e"


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def encode(
    rows: list[dict[str, Any]], batch_size: int, max_length: int
) -> tuple[np.ndarray, dict[str, Any]]:
    tokenizer = AutoTokenizer.from_pretrained(REPO, revision=REVISION)
    model = AutoModel.from_pretrained(REPO, revision=REVISION)
    model.eval()
    torch.set_num_threads(min(18, max(1, torch.get_num_threads())))
    vectors: list[np.ndarray] = []
    latencies: list[float] = []
    with torch.inference_mode():
        for start in range(0, len(rows), batch_size):
            batch = rows[start : start + batch_size]
            encoded = tokenizer(
                [row["query"] for row in batch],
                [row["candidate_text"] for row in batch],
                padding=True,
                truncation=True,
                max_length=max_length,
                return_tensors="pt",
            )
            began = time.perf_counter()
            hidden = model(**encoded).last_hidden_state
            mask = encoded["attention_mask"].unsqueeze(-1)
            pooled = (hidden * mask).sum(1) / mask.sum(1).clamp_min(1)
            vectors.append(pooled.cpu().numpy().astype(np.float32))
            latencies.append((time.perf_counter() - began) * 1000)
    all_vectors = np.concatenate(vectors)
    return all_vectors, {
        "batch_size": batch_size,
        "max_length": max_length,
        "pair_count": len(rows),
        "mean_batch_inference_ms": float(np.mean(latencies)),
        "p95_batch_inference_ms": float(np.percentile(latencies, 95)),
        "embedding_dimension": int(all_vectors.shape[1]),
    }


class Heads(nn.Module):
    def __init__(self, dimension: int) -> None:
        super().__init__()
        self.relevance = nn.Linear(dimension, 1)
        self.auxiliary = nn.Linear(dimension, 4)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        return self.relevance(x).squeeze(-1), self.auxiliary(x)


def group_metrics(rows: list[dict[str, Any]], scores: np.ndarray) -> dict[str, Any]:
    groups: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for row, score in zip(rows, scores):
        groups[row["group_id"]].append((float(score), float(row["label"])))
    reciprocal, ndcg, recall10 = [], [], []
    for values in groups.values():
        ranked = sorted(values, reverse=True)
        positives = sum(label > 0 for _, label in ranked)
        if not positives:
            continue
        first = next(
            (index + 1 for index, (_, label) in enumerate(ranked) if label > 0), None
        )
        reciprocal.append(1 / first if first else 0)
        recall10.append(sum(label > 0 for _, label in ranked[:10]) / positives)
        dcg = sum(
            (2**label - 1) / math.log2(index + 2)
            for index, (_, label) in enumerate(ranked[:10])
        )
        ideal = sorted((label for _, label in ranked), reverse=True)[:10]
        idcg = sum(
            (2**label - 1) / math.log2(index + 2) for index, label in enumerate(ideal)
        )
        ndcg.append(dcg / idcg if idcg else 0)
    return {
        "mrr": float(np.mean(reciprocal)),
        "ndcg_at_10": float(np.mean(ndcg)),
        "recall_at_10": float(np.mean(recall10)),
    }


def train_config(
    rows: list[dict[str, Any]],
    vectors: np.ndarray,
    objective: str,
    negative_ratio: int,
    seed: int,
) -> tuple[Heads, dict[str, Any]]:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    train_idx = [i for i, row in enumerate(rows) if row["split"] == "train"]
    dev_idx = [i for i, row in enumerate(rows) if row["split"] == "dev"]
    selected: list[int] = []
    grouped: dict[str, list[int]] = defaultdict(list)
    for index in train_idx:
        grouped[rows[index]["group_id"]].append(index)
    for indices in grouped.values():
        pos = [i for i in indices if rows[i]["label"] == 1]
        neg = [i for i in indices if rows[i]["label"] == 0]
        selected.extend(pos + neg[:negative_ratio])
    x = torch.from_numpy(vectors[selected])
    y = torch.tensor([rows[i]["label"] for i in selected], dtype=torch.float32)
    aux = torch.tensor(
        [
            [
                rows[i][field]
                for field in (
                    "status_valid",
                    "temporal_valid",
                    "citation_match",
                    "authority_match",
                )
            ]
            for i in selected
        ],
        dtype=torch.float32,
    )
    model = Heads(vectors.shape[1])
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=1e-3)
    bce = nn.BCEWithLogitsLoss()
    began = time.perf_counter()
    for _ in range(120):
        relevance, auxiliary = model(x)
        point = bce(relevance, y)
        aux_loss = bce(auxiliary, aux)
        pair_terms = []
        list_terms = []
        offset = {index: position for position, index in enumerate(selected)}
        for indices in grouped.values():
            positions = [offset[i] for i in indices if i in offset]
            positives = [p for p in positions if y[p] == 1]
            negatives = [p for p in positions if y[p] == 0]
            if positives and negatives:
                pair_terms.append(
                    torch.relu(
                        0.2 - relevance[positives[0]] + relevance[negatives]
                    ).mean()
                )
                list_terms.append(
                    -torch.log_softmax(relevance[positions], dim=0)[
                        positions.index(positives[0])
                    ]
                )
        pair = torch.stack(pair_terms).mean() if pair_terms else point * 0
        listwise = torch.stack(list_terms).mean() if list_terms else point * 0
        if objective == "pointwise":
            loss = point + 0.2 * aux_loss
        elif objective == "pairwise":
            loss = pair + 0.2 * point + 0.2 * aux_loss
        elif objective == "listwise":
            loss = listwise + 0.2 * point + 0.2 * aux_loss
        else:
            loss = point + pair + 0.2 * listwise + 0.2 * aux_loss
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
    with torch.inference_mode():
        dev_scores = torch.sigmoid(model(torch.from_numpy(vectors[dev_idx]))[0]).numpy()
    metrics = group_metrics([rows[i] for i in dev_idx], dev_scores)
    metrics.update(
        {
            "objective": objective,
            "negative_ratio": negative_ratio,
            "seed": seed,
            "training_seconds": time.perf_counter() - began,
            "train_pair_count": len(selected),
        }
    )
    return model, metrics


def model_to_json(model: Heads) -> dict[str, Any]:
    return {
        "relevance_weight": model.relevance.weight.detach()
        .numpy()
        .reshape(-1)
        .tolist(),
        "relevance_bias": float(model.relevance.bias.detach()),
        "auxiliary_weight": model.auxiliary.weight.detach().numpy().tolist(),
        "auxiliary_bias": model.auxiliary.bias.detach().numpy().tolist(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pairs", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--max-length", type=int, default=128)
    parser.add_argument("--seed", type=int, default=1932)
    args = parser.parse_args()
    rows = read_jsonl(args.pairs)
    vectors, inference = encode(rows, args.batch_size, args.max_length)
    experiments = []
    trained = []
    for objective in ("pointwise", "pairwise", "listwise", "combined"):
        for ratio in (2, 4, 8):
            model, metrics = train_config(rows, vectors, objective, ratio, args.seed)
            experiments.append(metrics)
            trained.append(model)
    best_index = max(
        range(len(experiments)),
        key=lambda i: (
            experiments[i]["mrr"] + experiments[i]["ndcg_at_10"],
            experiments[i]["recall_at_10"],
        ),
    )
    selected = experiments[best_index]
    head = model_to_json(trained[best_index])
    head_payload = {
        "format": "frozen_encoder_linear_multi_head_v1",
        "base_model": REPO,
        "base_revision": REVISION,
        "selected_on": "dev_only",
        "configuration": selected,
        "head": head,
    }
    args.output.mkdir(parents=True, exist_ok=True)
    head_json = (
        json.dumps(head_payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    (args.output / "custom_head.json").write_text(head_json, encoding="utf-8")
    registry = {
        "dataset_hash": hashlib.sha256(args.pairs.read_bytes()).hexdigest(),
        "base_model": REPO,
        "revision": REVISION,
        "architecture": "frozen DistilBERT multilingual pair encoder + separate relevance/status/temporal/citation/authority linear heads",
        "runtime": {
            "python": __import__("sys").version,
            "torch": torch.__version__,
            "device": "cpu",
            "dtype": "float32",
        },
        "inference": inference,
        "experiments": experiments,
        "selected_experiment": selected,
        "head_sha256": hashlib.sha256(head_json.encode()).hexdigest(),
        "frozen_test_used_for_selection": False,
        "qwen_used": False,
    }
    (args.output / "experiment_registry.json").write_text(
        json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "selected": selected,
                "inference": inference,
                "head_sha256": registry["head_sha256"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
