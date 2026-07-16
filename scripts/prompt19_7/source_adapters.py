#!/usr/bin/env python3
"""Phase 5 - Source Metadata Adapters

Extracts document metadata from PDF filenames and document text.
Family-specific adapters for ARLIS, ECHR, government decisions, etc.
"""
import json, re, sys, time
from pathlib import Path
from datetime import datetime, timezone

OUTPUT_DIR = Path(r"D:\1V\LegalArmenia-prompt19-7\AUDIT_REPORTS\artifacts")
INVENTORY_PATH = OUTPUT_DIR / "source_inventory.jsonl"
OUTPUT_JSONL = OUTPUT_DIR / "source_metadata_adapters.jsonl"
SUMMARY_PATH = OUTPUT_DIR / "source_metadata_adapters_summary.json"

# Parse ARLIS filename: {numeric_id}_{DD.MM.YYYY}_{title}_{hash}.pdf
ARLIS_RE = re.compile(r'^(\d+)_(\d{2})\.(\d{2})\.(\d{4})_(.+)_([0-9a-f]{10})\.pdf$')

# Document type keywords
TYPE_MAP = {
    "օրենք": "law",
    "կոդեքս": "code",
    "սահմանադրություն": "constitution",
    "որոշում": "decision",
    "հրաման": "order",
    "կարգադրություն": "decree",
    "հանձնաժողովի": "commission",
    "դատավոր": "judge",
    "վճիռ": "judgment",
    "որոշումը": "decision",
}

AUTHORITY_MAP = {
    "ազգային ժողովի": "national_assembly",
    "կառավարության": "government",
    "նախարարի": "minister",
    "նախագահի": "president",
    "վարչապետի": "prime_minister",
    "սահմանադրական դատարան": "constitutional_court",
    "վճռաբեկման դատարան": "court_of_cassation",
    "եվրոպական դատարան": "echr",
}

def detect_doc_type(title):
    title_lower = title.lower()
    for keyword, doc_type in TYPE_MAP.items():
        if keyword in title_lower:
            return doc_type
    return "unknown"

def detect_authority(title):
    title_lower = title.lower()
    for keyword, authority in AUTHORITY_MAP.items():
        if keyword in title_lower:
            return authority
    return "unknown"

def detect_arlis_url(text):
    m = re.search(r'arlis\.am/DocumentView\.aspx\?DocID=(\d+)', text)
    if m:
        return f"http://www.arlis.am/DocumentView.aspx?DocID={m.group(1)}", m.group(1)
    return None, None

def adapter_arlis(rec, parsed):
    title = parsed["title_raw"].replace("_", " ")
    doc_type = detect_doc_type(title)
    authority = detect_authority(title)
    date_str = f"{parsed['date'][6:10]}-{parsed['date'][3:5]}-{parsed['date'][0:2]}"
    
    return {
        "source_file_id": rec["source_file_id"],
        "filename": rec["filename"],
        "document_id": None,
        "document_version_id": None,
        "canonical_title": title,
        "document_number": parsed["numeric_id"],
        "document_type": doc_type,
        "authority": authority,
        "jurisdiction": "armenia",
        "adoption_date": date_str,
        "publication_date": None,
        "effective_from": None,
        "effective_to": None,
        "source_url": f"http://www.arlis.am/DocumentView.aspx?DocID={parsed['numeric_id']}",
        "parser_version": "prompt19_7_v1",
        "confidence": "high",
        "evidence": ["filename_numeric_id", "filename_date", "filename_title"],
    }

def adapter_echr(rec):
    return {
        "source_file_id": rec["source_file_id"],
        "filename": rec["filename"],
        "document_id": None,
        "document_version_id": None,
        "canonical_title": rec["filename"],
        "document_number": None,
        "document_type": "echr_decision",
        "authority": "echr",
        "jurisdiction": "european_court",
        "adoption_date": None,
        "publication_date": None,
        "effective_from": None,
        "effective_to": None,
        "source_url": None,
        "parser_version": "prompt19_7_v1",
        "confidence": "medium",
        "evidence": ["echr_family"],
    }

def adapter_generic(rec):
    return {
        "source_file_id": rec["source_file_id"],
        "filename": rec["filename"],
        "document_id": None,
        "document_version_id": None,
        "canonical_title": rec["filename"].rsplit(".", 1)[0].replace("_", " "),
        "document_number": None,
        "document_type": "unknown",
        "authority": "unknown",
        "jurisdiction": "armenia",
        "adoption_date": None,
        "publication_date": None,
        "effective_from": None,
        "effective_to": None,
        "source_url": None,
        "parser_version": "prompt19_7_v1",
        "confidence": "low",
        "evidence": ["filename_only"],
    }

def main():
    start = time.time()
    results = []
    family_counts = {}
    confidence_counts = {"high": 0, "medium": 0, "low": 0}
    type_counts = {}
    authority_counts = {}
    with_url = 0
    
    with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            if rec["extension"] != ".pdf" or rec["empty"]:
                continue
            
            family = rec["source_family"]
            m = ARLIS_RE.match(rec["filename"])
            
            if m:
                parsed = {
                    "numeric_id": m.group(1),
                    "date": m.group(0).split("_")[1],
                    "title_raw": m.group(5),
                    "file_hash": m.group(6),
                }
                result = adapter_arlis(rec, parsed)
            elif family == "ECHR":
                result = adapter_echr(rec)
            else:
                result = adapter_generic(rec)
            
            results.append(result)
            
            family_counts[family] = family_counts.get(family, 0) + 1
            confidence_counts[result["confidence"]] += 1
            type_counts[result["document_type"]] = type_counts.get(result["document_type"], 0) + 1
            authority_counts[result["authority"]] = authority_counts.get(result["authority"], 0) + 1
            if result["source_url"]:
                with_url += 1
    
    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f:
        for r in results[:10000]:  # Limit output for review
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    
    elapsed = time.time() - start
    summary = {
        "total_records": len(results),
        "output_records": min(len(results), 10000),
        "family_counts": family_counts,
        "confidence_counts": confidence_counts,
        "type_counts": type_counts,
        "authority_counts": authority_counts,
        "with_source_url": with_url,
        "source_url_coverage_pct": round(with_url / max(len(results), 1) * 100, 1),
        "elapsed_seconds": round(elapsed, 2),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    with open(SUMMARY_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(json.dumps(summary, indent=2, ensure_ascii=True))

if __name__ == "__main__":
    main()
