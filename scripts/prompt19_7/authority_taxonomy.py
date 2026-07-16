#!/usr/bin/env python3
"""Phase 9 - Legal Authority Taxonomy

Creates authority taxonomy from source metadata adapter output.
"""
import json, sys, time
from pathlib import Path
from datetime import datetime, timezone

OUTPUT_DIR = Path(r"D:\1V\LegalArmenia-prompt19-7\AUDIT_REPORTS\artifacts")
ADAPTER_PATH = OUTPUT_DIR / "source_metadata_adapters_summary.json"
OUTPUT_PATH = OUTPUT_DIR / "authority_taxonomy.json"

AUTHORITY_RANK = {
    "constitution": 1,
    "constitutional_court": 2,
    "code": 3,
    "law": 4,
    "national_assembly": 4,
    "court_of_cassation": 5,
    "echr": 6,
    "government": 7,
    "prime_minister": 8,
    "president": 8,
    "minister": 9,
    "commission": 10,
    "municipal": 11,
    "unknown": 99,
}

BINDING_SCOPE = {
    "constitution": "national_binding",
    "constitutional_court": "national_binding",
    "code": "national_binding",
    "law": "national_binding",
    "national_assembly": "national_binding",
    "court_of_cassation": "precedential",
    "echr": "international_binding",
    "government": "national_binding",
    "prime_minister": "national_binding",
    "president": "national_binding",
    "minister": "subordinate",
    "commission": "subordinate",
    "municipal": "local",
    "unknown": "unknown",
}

def main():
    with open(ADAPTER_PATH, "r", encoding="utf-8") as f:
        adapter_summary = json.load(f)
    
    authority_counts = adapter_summary.get("authority_counts", {})
    
    taxonomy = {}
    for authority, count in authority_counts.items():
        taxonomy[authority] = {
            "authority_type": authority,
            "authority_rank": AUTHORITY_RANK.get(authority, 99),
            "binding_scope": BINDING_SCOPE.get(authority, "unknown"),
            "jurisdiction": "armenia" if authority != "echr" else "european_court",
            "issuing_body": authority,
            "official_source": "arlis.am" if authority != "echr" else "echr.coe.int",
            "document_count": count,
        }
    
    output = {
        "taxonomy": taxonomy,
        "total_authorities": len(taxonomy),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(json.dumps({"total_authorities": len(taxonomy), "authorities": list(taxonomy.keys())}, indent=2, ensure_ascii=True))

if __name__ == "__main__":
    main()
