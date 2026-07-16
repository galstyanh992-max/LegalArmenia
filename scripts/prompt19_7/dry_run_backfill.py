#!/usr/bin/env python3
"""Phase 12 - Dry-Run Backfill

Simulates backfill of metadata into the additive schema tables.
No production writes. Reports counts and conflicts.
"""
import json, sys, time
from pathlib import Path
from datetime import datetime, timezone

OUTPUT_DIR = Path(r"D:\1V\LegalArmenia-prompt19-7\AUDIT_REPORTS\artifacts")
PROVISION_PATH = OUTPUT_DIR / "provision_reconstruction.jsonl"
ADAPTER_PATH = OUTPUT_DIR / "source_metadata_adapters.jsonl"
VERSION_PATH = OUTPUT_DIR / "version_lineage.jsonl"
SUMMARY_PATH = OUTPUT_DIR / "dry_run_backfill_summary.json"

def main():
    start = time.time()
    
    rows_examined = 0
    rows_matched = 0
    high_conf = 0
    medium_conf = 0
    low_conf = 0
    skipped = 0
    conflicts = 0
    failures = 0
    page_mappings = 0
    provision_mappings = 0
    version_mappings = 0
    authority_mappings = 0
    source_url_recoveries = 0
    
    # Process provision reconstruction
    try:
        with open(PROVISION_PATH, "r", encoding="utf-8") as f:
            for line in f:
                rec = json.loads(line)
                rows_examined += 1
                if rec.get("article"):
                    provision_mappings += 1
                    rows_matched += 1
                    if rec["confidence"] == "high": high_conf += 1
                    elif rec["confidence"] == "medium": medium_conf += 1
                    else: low_conf += 1
                else:
                    skipped += 1
    except FileNotFoundError:
        pass
    
    # Process metadata adapters
    try:
        with open(ADAPTER_PATH, "r", encoding="utf-8") as f:
            for line in f:
                rec = json.loads(line)
                if rec.get("authority") and rec["authority"] != "unknown":
                    authority_mappings += 1
                if rec.get("source_url"):
                    source_url_recoveries += 1
    except FileNotFoundError:
        pass
    
    # Process version lineage
    try:
        with open(VERSION_PATH, "r", encoding="utf-8") as f:
            for line in f:
                rec = json.loads(line)
                if rec.get("document_version_key"):
                    version_mappings += 1
    except FileNotFoundError:
        pass
    
    elapsed = time.time() - start
    summary = {
        "dry_run": True,
        "rows_examined": rows_examined,
        "rows_matched": rows_matched,
        "high_confidence": high_conf,
        "medium_confidence": medium_conf,
        "low_confidence": low_conf,
        "skipped": skipped,
        "conflicts": conflicts,
        "failures": failures,
        "page_mappings": page_mappings,
        "provision_mappings": provision_mappings,
        "version_mappings": version_mappings,
        "authority_mappings": authority_mappings,
        "source_url_recoveries": source_url_recoveries,
        "elapsed_seconds": round(elapsed, 2),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "production_writes": 0,
    }
    
    with open(SUMMARY_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(json.dumps(summary, indent=2, ensure_ascii=True))

if __name__ == "__main__":
    main()
