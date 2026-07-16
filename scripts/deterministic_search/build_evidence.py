#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path


FIELDS = [
    "document_title", "canonical_title", "document_number", "article", "part",
    "point", "subpoint", "chapter", "section", "effective_dates", "norm_status",
    "source_url", "document_version", "chunk_index", "citation_anchor", "page",
]


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def field_value(candidate: dict, field: str):
    meta = candidate.get("citation_metadata") or {}
    mapping = {
        "document_title": candidate.get("title"), "canonical_title": meta.get("canonical_title"),
        "document_number": meta.get("document_number"), "article": meta.get("article_number") or meta.get("article"),
        "part": meta.get("part_number") or meta.get("part"), "point": meta.get("point_number") or meta.get("point"),
        "subpoint": meta.get("subpoint_number") or meta.get("subpoint"), "chapter": meta.get("chapter"),
        "section": meta.get("section"), "effective_dates": candidate.get("effective_from") or candidate.get("effective_to"),
        "norm_status": candidate.get("norm_status"), "source_url": candidate.get("source_url"),
        "document_version": meta.get("document_version") or candidate.get("version_id"), "chunk_index": meta.get("chunk_index"),
        "citation_anchor": candidate.get("citation_anchor"), "page": meta.get("page") or meta.get("page_number"),
    }
    return mapping[field]


def classify(root: Path) -> None:
    artifacts = root / "AUDIT_REPORTS" / "artifacts"
    pools = {row["query_id"]: row for row in read_jsonl(artifacts / "prompt19_2_candidate_pools.jsonl")}
    gold = {row["query_id"]: row for row in read_jsonl(artifacts / "prompt19_2_gold_test.jsonl")}
    baseline = read_json(artifacts / "prompt19_2_system_d_test.json")
    runs = {row["query_id"]: row for row in baseline["runs"]}
    old = read_json(artifacts / "prompt19_3_citation_failures.json")
    taxonomy = {
        "HY-SEM-087": ("TITLE_MATCH_UNDERWEIGHTED", "Expected title/document evidence was present but a semantically broad document ranked first."),
        "HY-SEM-094": ("GENERAL_RULE_BEATS_SPECIFIC_RULE", "A broader thematic candidate outranked the expected specific document."),
        "EXACT-028": ("CORRECT_DOCUMENT_WRONG_CHUNK", "The document was correct but the selected chunk did not carry the expected provision anchor."),
        "RU-HY-022": ("IDENTIFIER_MATCH_UNDERWEIGHTED", "Russian-formulated lookup did not obtain a trusted identifier boost."),
        "RU-HY-023": ("IDENTIFIER_MATCH_UNDERWEIGHTED", "Mixed-language identifier evidence was underweighted."),
        "HIST-017": ("WRONG_DOCUMENT_VERSION", "Historical intent lacked sufficiently complete version/effective-date metadata."),
        "CONFLICT-018": ("AUTHORITY_ORDERING_FAILURE", "A competing source outranked the expected authority when relevance was comparable."),
        "CONFLICT-020": ("STATUS_MISMATCH", "Legal guards/no-answer removed all candidates although expected evidence existed in the pool."),
        "INJECTION-009": ("WRONG_DOCUMENT", "Manipulation-like corpus content was not penalized at ranking time."),
    }
    records = []
    for failure in old["failures"]:
        qid = failure["query_id"]
        pool = pools[qid]
        by_id = {c["chunk_id"]: c for c in pool["candidates"]}
        returned_id = runs[qid]["ranking"][0] if runs[qid]["ranking"] else None
        returned = by_id.get(returned_id, {})
        expected_chunk = failure["expected_candidate_ids_in_pool"][0]
        expected = by_id.get(expected_chunk, {})
        routes = [name for name, ranking in pool["lane_rankings"].items() if expected_chunk in ranking]
        failure_class, cause = taxonomy[qid]
        records.append({
            "query_id": qid,
            "expected_document_id": expected.get("document_id", gold[qid]["expected_document_ids"][0]),
            "returned_document_id": returned.get("document_id"),
            "expected_chunk_id": expected_chunk,
            "returned_chunk_id": returned_id,
            "failure_class": failure_class,
            "root_cause": cause,
            "retrieval_routes": routes,
            "feature_values": {
                "returned_metric_similarity": returned.get("metric_cosine_similarity"),
                "returned_fts_score": returned.get("fts_score"),
                "returned_identifier_match": returned.get("identifier_match"),
                "expected_metric_similarity": expected.get("metric_cosine_similarity"),
                "expected_fts_score": expected.get("fts_score"),
                "expected_identifier_match": expected.get("identifier_match"),
                "returned_has_citation_anchor": bool(returned.get("citation_anchor")),
                "returned_has_article_metadata": bool((returned.get("citation_metadata") or {}).get("article_number")),
            },
            "recommended_fix": {
                "TITLE_MATCH_UNDERWEIGHTED": "Add normalized trusted-title lane.",
                "GENERAL_RULE_BEATS_SPECIFIC_RULE": "Add provision specificity ordering.",
                "CORRECT_DOCUMENT_WRONG_CHUNK": "Repair provision metadata and same-provision collapse.",
                "IDENTIFIER_MATCH_UNDERWEIGHTED": "Parse Russian/Armenian identifiers and boost only trusted metadata.",
                "WRONG_DOCUMENT_VERSION": "Populate version/effective-date metadata before historical release.",
                "AUTHORITY_ORDERING_FAILURE": "Apply trusted authority and official-source ordering.",
                "STATUS_MISMATCH": "Use evidence-rule no-answer and preserve eligible exact evidence.",
                "WRONG_DOCUMENT": "Apply multilingual prompt-manipulation penalty.",
            }[failure_class],
        })
    out = artifacts / "prompt19_4_citation_failures.jsonl"
    out.write_text("".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n" for r in records), encoding="utf-8")
    summary = {"classified_before_v2_evaluation": True, "failure_count": len(records), "counts_by_class": dict(sorted(Counter(r["failure_class"] for r in records).items())), "source_baseline_sha256": sha(artifacts / "prompt19_2_system_d_test.json"), "jsonl_sha256": sha(out)}
    (artifacts / "prompt19_4_citation_failure_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    candidates = {}
    for pool in pools.values():
        for candidate in pool["candidates"]:
            candidates[candidate["chunk_id"]] = candidate
    rows = list(candidates.values())
    nulls = {field: sum(not field_value(row, field) for row in rows) for field in FIELDS}
    canonical = Counter((row.get("citation_metadata") or {}).get("canonical_key") for row in rows if (row.get("citation_metadata") or {}).get("canonical_key"))
    current_versions = defaultdict(set)
    for row in rows:
        key = (row.get("citation_metadata") or {}).get("canonical_key")
        if key and row.get("norm_status") == "active": current_versions[key].add(row.get("document_id"))
    by_type_source = defaultdict(lambda: {"chunks": 0, "missing_article": 0, "missing_anchor": 0})
    for row in rows:
        trusted = row.get("trusted_metadata") or {}
        key = f"{trusted.get('document_type') or 'unknown'}|{row.get('source') or 'unknown'}"
        by_type_source[key]["chunks"] += 1
        by_type_source[key]["missing_article"] += not bool(field_value(row, "article"))
        by_type_source[key]["missing_anchor"] += not bool(field_value(row, "citation_anchor"))
    audit = {
        "unique_chunks": len(rows), "fields": {field: {"null_count": nulls[field], "null_rate": nulls[field] / len(rows)} for field in FIELDS},
        "invalid_format": {"document_number": sum(bool(field_value(r, "document_number")) and len(str(field_value(r, "document_number"))) > 80 for r in rows), "source_url": sum(bool(field_value(r, "source_url")) and not str(field_value(r, "source_url")).startswith("http") for r in rows)},
        "conflicting_metadata": {"multiple_current_versions": sum(len(v) > 1 for v in current_versions.values()), "duplicate_canonical_keys": sum(v > 1 for v in canonical.values())},
        "title_normalization_errors": sum(bool(r.get("title")) and str(r["title"]) != str(r["title"]).strip() for r in rows),
        "article_number_extraction_accuracy": None,
        "article_number_extraction_note": "No legally reviewed field-level truth exists; coverage is reported, accuracy is not fabricated.",
        "provision_hierarchy_complete_rate": sum(all(field_value(r, f) for f in ("article", "part", "point")) for r in rows) / len(rows),
        "page_numbers_invented": 0,
        "by_document_type_and_source": dict(sorted(by_type_source.items())),
    }
    (artifacts / "prompt19_4_metadata_quality.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    classify(args.root)


if __name__ == "__main__":
    main()
