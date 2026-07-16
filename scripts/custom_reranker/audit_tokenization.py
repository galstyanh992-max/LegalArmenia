#!/usr/bin/env python3
"""Audit Armenian legal tokenization for immutable non-Qwen encoder candidates."""

from __future__ import annotations

import argparse
import hashlib
import json
import statistics
from pathlib import Path
from typing import Any

from huggingface_hub import HfApi
from transformers import AutoConfig, AutoTokenizer

MODELS = [
    "FacebookAI/xlm-roberta-base",
    "distilbert/distilbert-base-multilingual-cased",
    "google-bert/bert-base-multilingual-cased",
]
TERMS = [
    "օրենք",
    "հոդված",
    "իրավունք",
    "պարտավորություն",
    "դատարան",
    "վճիռ",
    "закон",
    "статья",
    "право",
    "суд",
]


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def file_manifest_hash(info: Any) -> tuple[str | None, int]:
    entries = []
    for sibling in info.siblings or []:
        lfs = getattr(sibling, "lfs", None)
        sha = getattr(lfs, "sha256", None) if lfs else None
        size = getattr(lfs, "size", None) if lfs else getattr(sibling, "size", None)
        if sha:
            entries.append(f"{sibling.rfilename}:{sha}:{size}")
    if not entries:
        return None, 0
    payload = "\n".join(sorted(entries)) + "\n"
    return hashlib.sha256(payload.encode()).hexdigest(), len(entries)


def audit_model(
    repo: str, texts: list[str], russian_queries: list[str], api: HfApi
) -> dict[str, Any]:
    info = api.model_info(repo, files_metadata=True)
    revision = info.sha
    tokenizer = AutoTokenizer.from_pretrained(repo, revision=revision)
    config = AutoConfig.from_pretrained(repo, revision=revision)
    lengths = [
        len(tokenizer.encode(text, add_special_tokens=True, truncation=False))
        for text in texts
    ]
    chars = [max(1, len(text)) for text in texts]
    words = [max(1, len(text.split())) for text in texts]
    russian_lengths = [
        len(tokenizer.encode(text, add_special_tokens=True, truncation=False))
        for text in russian_queries
    ]
    term_counts = [len(tokenizer.tokenize(term)) for term in TERMS]
    article_samples = [text for text in texts if any(char.isdigit() for char in text)][
        :100
    ]
    preserved = 0
    for text in article_samples:
        digits = "".join(char for char in text if char.isdigit())
        decoded = tokenizer.decode(tokenizer.encode(text, add_special_tokens=False))
        if digits and digits in "".join(char for char in decoded if char.isdigit()):
            preserved += 1
    weights_manifest_sha, weight_file_count = file_manifest_hash(info)
    license_name = (
        (info.card_data or {}).get("license")
        if isinstance(info.card_data, dict)
        else getattr(info.card_data, "license", None)
    )
    parameter_count = None
    if info.safetensors and getattr(info.safetensors, "parameters", None):
        parameter_count = sum(info.safetensors.parameters.values())
    return {
        "repository": repo,
        "revision": revision,
        "architecture": (getattr(config, "architectures", None) or [config.model_type])[
            0
        ],
        "tokenizer_class": tokenizer.__class__.__name__,
        "vocabulary_size": len(tokenizer),
        "license": license_name,
        "commercial_use_conclusion": "PERMITTED_SUBJECT_TO_LICENSE_TERMS"
        if license_name in {"apache-2.0", "mit"}
        else "REQUIRES_LEGAL_REVIEW",
        "parameter_count": parameter_count,
        "configured_max_sequence_length": tokenizer.model_max_length,
        "weights_lfs_manifest_sha256": weights_manifest_sha,
        "weight_file_count": weight_file_count,
        "armenian_tokens_per_character_mean": statistics.fmean(
            length / char for length, char in zip(lengths, chars)
        ),
        "armenian_tokens_per_word_mean": statistics.fmean(
            length / word for length, word in zip(lengths, words)
        ),
        "armenian_p50_tokens": statistics.median(lengths),
        "armenian_p95_tokens": sorted(lengths)[max(0, int(len(lengths) * 0.95) - 1)],
        "truncation_rate_at_128": sum(length > 128 for length in lengths)
        / len(lengths),
        "truncation_rate_at_256": sum(length > 256 for length in lengths)
        / len(lengths),
        "russian_query_mean_tokens": statistics.fmean(russian_lengths)
        if russian_lengths
        else None,
        "legal_term_mean_subtokens": statistics.fmean(term_counts),
        "legal_term_split_rate": sum(count > 1 for count in term_counts)
        / len(term_counts),
        "article_number_roundtrip_rate": preserved / len(article_samples)
        if article_samples
        else None,
        "section_markers": {
            marker: tokenizer.tokenize(marker)
            for marker in ["§", "N", "հոդված", "մաս", "կետ"]
        },
        "normalization": "tokenizer-native pair encoding; raw classifier scores must be calibrated separately",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    snapshot = read_jsonl(args.artifacts / "prompt19_2_corpus_snapshot.jsonl")
    expanded = read_jsonl(
        args.artifacts
        / "prompt19_3_training_data"
        / "expanded_engineering_queries.jsonl"
    )
    texts = [row["text"] for row in snapshot if row.get("language_code") == "hy"][:300]
    russian = [row["query"] for row in expanded if row.get("language") == "ru"][:100]
    api = HfApi()
    results = [audit_model(repo, texts, russian, api) for repo in MODELS]
    payload = {
        "status": "ENGINEERING_TOKENIZATION_AUDIT",
        "corpus_text_count": len(texts),
        "russian_query_count": len(russian),
        "candidates": results,
        "qwen_candidates": 0,
        "selection_rule": "Prefer lower Armenian fragmentation/truncation, production-compatible license, and measured task quality; model card claims are insufficient.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "models": [
                    {"repository": x["repository"], "revision": x["revision"]}
                    for x in results
                ]
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
