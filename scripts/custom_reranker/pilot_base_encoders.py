#!/usr/bin/env python3
"""Small fixed-seed training pilots for all audited non-Qwen base encoders."""

from __future__ import annotations

import argparse
import gc
import json
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn
from transformers import AutoModel, AutoTokenizer

MODELS = [
    ("FacebookAI/xlm-roberta-base", "e73636d4f797dec63c3081bb6ed5c7b0bb3f2089"),
    (
        "distilbert/distilbert-base-multilingual-cased",
        "45c032ab32cc946ad88a166f7cb282f58c753c2e",
    ),
    (
        "google-bert/bert-base-multilingual-cased",
        "3f076fdb1ab68d5b2880cb87a0886f315b8146f8",
    ),
]


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def choose_groups(
    rows: list[dict[str, Any]], split: str, limit: int
) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if row["split"] == split:
            groups[row["group_id"]].append(row)
    chosen = []
    for group in list(sorted(groups))[:limit]:
        chosen.extend(groups[group])
    return chosen


def embed(
    repo: str, revision: str, rows: list[dict[str, Any]]
) -> tuple[np.ndarray, dict[str, float]]:
    tokenizer = AutoTokenizer.from_pretrained(repo, revision=revision)
    model = AutoModel.from_pretrained(repo, revision=revision)
    model.eval()
    torch.set_num_threads(min(18, max(1, torch.get_num_threads())))
    vectors, latencies = [], []
    with torch.inference_mode():
        for start in range(0, len(rows), 16):
            batch = rows[start : start + 16]
            encoded = tokenizer(
                [r["query"] for r in batch],
                [r["candidate_text"] for r in batch],
                padding=True,
                truncation=True,
                max_length=64,
                return_tensors="pt",
            )
            began = time.perf_counter()
            hidden = model(**encoded).last_hidden_state
            mask = encoded["attention_mask"].unsqueeze(-1)
            vectors.append(
                ((hidden * mask).sum(1) / mask.sum(1).clamp_min(1)).cpu().numpy()
            )
            latencies.append((time.perf_counter() - began) * 1000)
    result = np.concatenate(vectors).astype(np.float32)
    metadata = {
        "p50_batch_ms": float(np.percentile(latencies, 50)),
        "p95_batch_ms": float(np.percentile(latencies, 95)),
        "dimension": int(result.shape[1]),
        "parameter_count": sum(p.numel() for p in model.parameters()),
    }
    del model
    gc.collect()
    return result, metadata


def train_eval(
    rows: list[dict[str, Any]], vectors: np.ndarray, train_count: int, seed: int
) -> dict[str, float]:
    torch.manual_seed(seed)
    model = nn.Linear(vectors.shape[1], 1)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-3)
    x = torch.from_numpy(vectors)
    y = torch.tensor([r["label"] for r in rows], dtype=torch.float32)
    for _ in range(80):
        logits = model(x[:train_count]).squeeze(-1)
        loss = nn.functional.binary_cross_entropy_with_logits(logits, y[:train_count])
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
    scores = torch.sigmoid(model(x[train_count:]).squeeze(-1)).detach().numpy()
    groups: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for row, score in zip(rows[train_count:], scores):
        groups[row["group_id"]].append((float(score), row["label"]))
    rr = []
    for values in groups.values():
        ranked = sorted(values, reverse=True)
        first = next((i + 1 for i, (_, label) in enumerate(ranked) if label == 1), None)
        if first:
            rr.append(1 / first)
    return {"dev_mrr": float(np.mean(rr)), "dev_group_count": len(rr)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pairs", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=1934)
    args = parser.parse_args()
    rows = read_jsonl(args.pairs)
    train = choose_groups(rows, "train", 24)
    dev = choose_groups(rows, "dev", 12)
    pilot_rows = train + dev
    results = []
    for repo, revision in MODELS:
        vectors, runtime = embed(repo, revision, pilot_rows)
        results.append(
            {
                "repository": repo,
                "revision": revision,
                "pilot_train_pairs": len(train),
                "pilot_dev_pairs": len(dev),
                "max_length": 64,
                "batch_size": 16,
                "frozen_encoder": True,
                **runtime,
                **train_eval(pilot_rows, vectors, len(train), args.seed),
            }
        )
    payload = {
        "seed": args.seed,
        "objective": "pointwise pilot",
        "test_split_used": False,
        "qwen_used": False,
        "results": results,
        "selection_note": "Pilot metrics are architecture screening only; full selected configuration is chosen on the complete dev engineering pairs.",
    }
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
