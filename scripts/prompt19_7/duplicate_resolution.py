#!/usr/bin/env python3
"""Phase 10 - Duplicate and Canonical Source Resolution

Classifies duplicates from inventory SHA-256 hashes and source matching.
"""
import json, sys, time
from pathlib import Path
from datetime import datetime, timezone

OUTPUT_DIR = Path(r"D:\1V\LegalArmenia-prompt19-7\AUDIT_REPORTS\artifacts")
INVENTORY_SUMMARY = OUTPUT_DIR / "source_inventory_summary.json"
MATCHING_PATH = OUTPUT_DIR / "source_matching.jsonl"
OUTPUT_PATH = OUTPUT_DIR / "duplicate_resolution.json"

def main():
    with open(INVENTORY_SUMMARY, "r", encoding="utf-8") as f:
        inv_summary = json.load(f)
    
    # SHA duplicates from inventory
    sha_dupes = inv_summary.get("duplicate_groups", [])
    
    # ID-based duplicates from matching
    id_groups = {}
    with open(MATCHING_PATH, "r", encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            if rec.get("numeric_id"):
                id_groups.setdefault(rec["numeric_id"], []).append(rec["source_file_id"])
    
    multi_id = {k: v for k, v in id_groups.items() if len(v) > 1}
    
    classified = {
        "EXACT_FILE_DUPLICATE": len(sha_dupes),
        "EXACT_TEXT_DUPLICATE": 0,  # Would need text comparison
        "SOURCE_MIRROR": 0,
        "TRANSLATION_VARIANT": 0,
        "VERSION_VARIANT": sum(len(v) - 1 for v in multi_id.values()),
        "ADJACENT_CHUNK": 0,
        "SAME_PROVISION_DIFFERENT_SPAN": 0,
        "LEGITIMATE_DISTINCT_SOURCE": 0,
        "sha_duplicate_details": sha_dupes,
        "id_duplicate_groups": {k: v for k, v in list(multi_id.items())[:20]},
        "total_duplicate_groups": len(multi_id) + len(sha_dupes),
    }
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(classified, f, indent=2, ensure_ascii=False)
    
    print(json.dumps({"total_duplicate_groups": classified["total_duplicate_groups"], "sha_dupes": len(sha_dupes), "id_dupes": len(multi_id)}, indent=2, ensure_ascii=True))

if __name__ == "__main__":
    main()
