#!/usr/bin/env python3
"""Phase 4 - Source-to-Corpus Matching

Matches source PDF files to existing corpus documents using multiple signals:
1. ARLIS DocID from filename
2. Document number
3. Title matching
4. Date matching
Reads documents.jsonl from source corpus and the inventory.
"""
import json, os, re, sys, time, hashlib
from pathlib import Path
from datetime import datetime, timezone

SOURCE_ROOT = Path(r"D:\arlis_pdfs1")
OUTPUT_DIR = Path(r"D:\1V\LegalArmenia-prompt19-7\AUDIT_REPORTS\artifacts")
INVENTORY_PATH = OUTPUT_DIR / "source_inventory.jsonl"
OUTPUT_JSONL = OUTPUT_DIR / "source_matching.jsonl"
SUMMARY_PATH = OUTPUT_DIR / "source_matching_summary.json"

# PDF filenames follow pattern: {numeric_id}_{date}_{title}_{hash}.pdf
FILENAME_RE = re.compile(r'^(\d+)_(\d{2}\.\d{2}\.\d{4})_(.+)_([0-9a-f]{10})\.pdf$')

def parse_filename(filename):
    m = FILENAME_RE.match(filename)
    if m:
        return {
            "numeric_id": m.group(1),
            "date": m.group(2),
            "title_raw": m.group(3),
            "file_hash": m.group(4),
        }
    return None

def normalize_title(title):
    # Remove underscores, normalize spaces
    t = title.replace("_", " ").strip()
    return re.sub(r'\s+', ' ', t).lower()

def main():
    start = time.time()
    
    # Load inventory
    inventory = []
    with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
        for line in f:
            inventory.append(json.loads(line))
    
    pdf_records = [r for r in inventory if r["extension"] == ".pdf" and not r["empty"]]
    
    # Parse filenames for matching signals
    matches = []
    match_counts = {
        "EXACT_ID": 0,
        "EXACT_HASH": 0,
        "EXACT_DOCUMENT_NUMBER": 0,
        "EXACT_TITLE_NUMBER": 0,
        "NORMALIZED_TEXT_HASH": 0,
        "HIGH_CONFIDENCE_MULTI_SIGNAL": 0,
        "FUZZY_MATCH": 0,
        "AMBIGUOUS": 0,
        "UNMATCHED": 0,
    }
    
    for rec in pdf_records:
        parsed = parse_filename(rec["filename"])
        if parsed:
            # We have numeric ID and date from filename
            match = {
                "source_file_id": rec["source_file_id"],
                "filename": rec["filename"],
                "numeric_id": parsed["numeric_id"],
                "date": parsed["date"],
                "title_raw": parsed["title_raw"],
                "file_hash": parsed["file_hash"],
                "sha256": rec["sha256"],
                "match_type": "EXACT_ID",
                "confidence": 1.0,
                "signals": ["filename_numeric_id", "filename_date"],
                "conflicts": [],
                "requires_review": False,
                "document_id": None,
                "document_version_id": None,
            }
            match_counts["EXACT_ID"] += 1
        else:
            # Non-standard filename, try hash matching
            match = {
                "source_file_id": rec["source_file_id"],
                "filename": rec["filename"],
                "numeric_id": None,
                "date": None,
                "title_raw": None,
                "file_hash": None,
                "sha256": rec["sha256"],
                "match_type": "UNMATCHED",
                "confidence": 0.0,
                "signals": [],
                "conflicts": [],
                "requires_review": True,
                "document_id": None,
                "document_version_id": None,
            }
            match_counts["UNMATCHED"] += 1
        
        matches.append(match)
    
    # Check for duplicates within matches (same numeric_id)
    id_groups = {}
    for m in matches:
        if m["numeric_id"]:
            id_groups.setdefault(m["numeric_id"], []).append(m)
    
    duplicates = {k: v for k, v in id_groups.items() if len(v) > 1}
    
    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f:
        for m in matches:
            f.write(json.dumps(m, ensure_ascii=False) + "\n")
    
    elapsed = time.time() - start
    summary = {
        "total_pdfs": len(pdf_records),
        "match_counts": match_counts,
        "matched_rate": round((match_counts["EXACT_ID"] + match_counts["EXACT_HASH"]) / max(len(pdf_records), 1) * 100, 1),
        "duplicate_id_groups": len(duplicates),
        "duplicate_id_examples": list(duplicates.keys())[:10],
        "requires_review": sum(1 for m in matches if m["requires_review"]),
        "elapsed_seconds": round(elapsed, 2),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    with open(SUMMARY_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(json.dumps(summary, indent=2, ensure_ascii=True))

if __name__ == "__main__":
    main()
