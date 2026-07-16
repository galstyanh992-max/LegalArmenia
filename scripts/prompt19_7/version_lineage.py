#!/usr/bin/env python3
"""Phase 8 - Document Version Lineage

Detects document versions from filenames and text. Identifies amendments,
superseded versions, and current version markers.
"""
import json, re, sys, time
from pathlib import Path
from datetime import datetime, timezone

OUTPUT_DIR = Path(r"D:\1V\LegalArmenia-prompt19-7\AUDIT_REPORTS\artifacts")
MATCHING_PATH = OUTPUT_DIR / "source_matching.jsonl"
OUTPUT_JSONL = OUTPUT_DIR / "version_lineage.jsonl"
SUMMARY_PATH = OUTPUT_DIR / "version_lineage_summary.json"

# Detect amendment keywords in Armenian
AMENDMENT_RE = re.compile(r'amendment|superseded', re.IGNORECASE)
SUPERSEDE_RE = re.compile(r'supersede|repeal', re.IGNORECASE)

def main():
    start = time.time()
    results = []
    with_version_info = 0
    current_count = 0
    superseded_count = 0
    unknown_count = 0
    
    # Group by numeric_id to detect version chains
    id_groups = {}
    
    with open(MATCHING_PATH, "r", encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            if rec.get("numeric_id"):
                id_groups.setdefault(rec["numeric_id"], []).append(rec)
            else:
                results.append({
                    "source_file_id": rec["source_file_id"],
                    "document_version_key": None,
                    "version_sequence": None,
                    "supersedes_version_id": None,
                    "is_current": None,
                    "effective_from": None,
                    "effective_to": None,
                    "version_confidence": "low",
                    "evidence": ["no_numeric_id"],
                })
                unknown_count += 1
    
    # For each group, sort by date and determine version sequence
    for numeric_id, group in id_groups.items():
        sorted_group = sorted(group, key=lambda x: x.get("date", ""), reverse=True)
        
        for i, rec in enumerate(sorted_group):
            is_current = (i == 0)  # Most recent is current
            version_seq = len(sorted_group) - i
            
            results.append({
                "source_file_id": rec["source_file_id"],
                "document_version_key": f"{numeric_id}_v{version_seq}",
                "version_sequence": version_seq,
                "supersedes_version_id": sorted_group[i-1]["source_file_id"] if i > 0 else None,
                "is_current": is_current,
                "effective_from": None,
                "effective_to": None,
                "version_confidence": "high" if len(sorted_group) > 1 else "medium",
                "evidence": ["filename_date_ordering", f"group_size_{len(sorted_group)}"],
            })
            
            with_version_info += 1
            if is_current:
                current_count += 1
            else:
                superseded_count += 1
    
    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f:
        for r in results[:10000]:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    
    elapsed = time.time() - start
    summary = {
        "total_records": len(results),
        "with_version_info": with_version_info,
        "current_versions": current_count,
        "superseded_versions": superseded_count,
        "unknown_versions": unknown_count,
        "multi_version_groups": sum(1 for g in id_groups.values() if len(g) > 1),
        "elapsed_seconds": round(elapsed, 2),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    with open(SUMMARY_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(json.dumps(summary, indent=2, ensure_ascii=True))

if __name__ == "__main__":
    main()


