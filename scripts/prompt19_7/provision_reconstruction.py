#!/usr/bin/env python3
"""Phase 6 - Provision Metadata Reconstruction

Parses Armenian legal document text to reconstruct article/part/point/subpoint
metadata. Uses regex patterns for Armenian, Russian, and English legal citation formats.
Reads documents.jsonl from source corpus (streaming, first N records for dry-run).
"""
import json, re, sys, time
from pathlib import Path
from datetime import datetime, timezone

SOURCE_JSONL = Path(r"D:\arlis_pdfs1\documents.jsonl")
OUTPUT_DIR = Path(r"D:\1V\LegalArmenia-prompt19-7\AUDIT_REPORTS\artifacts")
OUTPUT_JSONL = OUTPUT_DIR / "provision_reconstruction.jsonl"
SUMMARY_PATH = OUTPUT_DIR / "provision_reconstruction_summary.json"
MAX_RECORDS = 5000  # dry-run sample

# Armenian provision patterns
ARTICLE_PATTERNS = [
    re.compile(r'(\d+)[-]+\s*\u0580\u0564\s*\u057e\u0561\u0581\u0561\u056e', re.IGNORECASE),  # N-րդ հոդված
    re.compile(r'\u0570\u0578\u0564\u057e\u0561\u056e\s*(\d+)', re.IGNORECASE),  # հոդված N
    re.compile(r'\u0570\u0578\u0564\u057e\u0561\u056e\u056b\s*(\d+)', re.IGNORECASE),  # հոդվածի N
    re.compile(r'(?:article|art\.?)\s*(\d+(?:\.\d+)?)', re.IGNORECASE),
    re.compile(r'(?:\u0441\u0442\u0430\u0442\u044c\u044f)\s*(\d+)', re.IGNORECASE),
]

PART_PATTERNS = [
    re.compile(r'\u0574\u0561\u057d\s*(\d+)', re.IGNORECASE),  # մաս N
    re.compile(r'\u0574\u0561\u057d\u056b\s*(\d+)', re.IGNORECASE),  # մասի N
    re.compile(r'(?:part)\s*(\d+)', re.IGNORECASE),
    re.compile(r'(?:\u0447\u0430\u0441\u0442\u044c)\s*(\d+)', re.IGNORECASE),
]

POINT_PATTERNS = [
    re.compile(r'\u056f\u0565\u057f\s*(\d+)', re.IGNORECASE),  # կետ N
    re.compile(r'\u056f\u0565\u057f\u056b\s*(\d+)', re.IGNORECASE),  # կետի N
    re.compile(r'(?:point|clause)\s*(\d+)', re.IGNORECASE),
    re.compile(r'(?:\u043f\u0443\u043d\u043a\u0442)\s*(\d+)', re.IGNORECASE),
]

SUBPOINT_PATTERNS = [
    re.compile(r'\u00ab\u0561\u00bb\s*\u0565\u0576\u057f\u0561\u056f\u0565\u057f', re.IGNORECASE),  # «ա» ենթակետ
    re.compile(r'[a-z]\)\s', re.IGNORECASE),  # a) subpoint
]

CHAPTER_PATTERNS = [
    re.compile(r'\u0570\u0561\u0575\u0580\u056b\u0576\s*(\d+)', re.IGNORECASE),  # հայրին N (chapter)
    re.compile(r'(?:chapter|ch\.?)\s*(\d+)', re.IGNORECASE),
    re.compile(r'\u0433\u043b\u0430\u0432\u0430\s*(\d+)', re.IGNORECASE),
]

def extract_provisions(text):
    article = None
    part = None
    point = None
    subpoint = None
    chapter = None
    evidence = []
    
    for pat in ARTICLE_PATTERNS:
        m = pat.search(text[:5000])  # Check first 5000 chars
        if m:
            article = m.group(1)
            evidence.append(f"article:{m.group(0)[:50]}")
            break
    
    for pat in PART_PATTERNS:
        m = pat.search(text[:5000])
        if m:
            part = m.group(1)
            evidence.append(f"part:{m.group(0)[:50]}")
            break
    
    for pat in POINT_PATTERNS:
        m = pat.search(text[:5000])
        if m:
            point = m.group(1)
            evidence.append(f"point:{m.group(0)[:50]}")
            break
    
    for pat in CHAPTER_PATTERNS:
        m = pat.search(text[:5000])
        if m:
            chapter = m.group(1)
            evidence.append(f"chapter:{m.group(0)[:50]}")
            break
    
    for pat in SUBPOINT_PATTERNS:
        m = pat.search(text[:2000])
        if m:
            subpoint = m.group(0)[:2]
            evidence.append(f"subpoint:{m.group(0)[:30]}")
            break
    
    # Build provision key
    provision_key = None
    if article:
        parts = [f"art_{article}"]
        if part: parts.append(f"pt_{part}")
        if point: parts.append(f"pt_{point}")
        provision_key = ".".join(parts)
    
    # Build canonical citation
    canonical_citation = None
    if article:
        cit_parts = [f"Article {article}"]
        if part: cit_parts.append(f"Part {part}")
        if point: cit_parts.append(f"Point {point}")
        canonical_citation = " ".join(cit_parts)
    
    # Confidence
    if article and evidence:
        confidence = "high" if len(evidence) >= 2 else "medium"
    else:
        confidence = "low"
    
    return {
        "article": article,
        "part": part,
        "point": point,
        "subpoint": subpoint,
        "chapter": chapter,
        "section": None,
        "provision_key": provision_key,
        "canonical_citation": canonical_citation,
        "confidence": confidence,
        "evidence": evidence,
    }

def main():
    start = time.time()
    results = []
    total = 0
    with_article = 0
    with_part = 0
    with_point = 0
    with_chapter = 0
    high_conf = 0
    medium_conf = 0
    low_conf = 0
    
    with open(SOURCE_JSONL, "r", encoding="utf-8") as f:
        for line in f:
            if total >= MAX_RECORDS:
                break
            try:
                doc = json.loads(line)
            except:
                continue
            total += 1
            text = doc.get("full_text", "")
            filename = doc.get("filename", "")
            
            prov = extract_provisions(text)
            prov["source_file_id"] = filename
            prov["document_id"] = None
            prov["chunk_id"] = None
            prov["parser_version"] = "prompt19_7_v1"
            
            results.append(prov)
            
            if prov["article"]: with_article += 1
            if prov["part"]: with_part += 1
            if prov["point"]: with_point += 1
            if prov["chapter"]: with_chapter += 1
            if prov["confidence"] == "high": high_conf += 1
            elif prov["confidence"] == "medium": medium_conf += 1
            else: low_conf += 1
    
    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    
    elapsed = time.time() - start
    summary = {
        "records_examined": total,
        "records_with_article": with_article,
        "records_with_part": with_part,
        "records_with_point": with_point,
        "records_with_chapter": with_chapter,
        "article_coverage_pct": round(with_article / max(total, 1) * 100, 1),
        "high_confidence": high_conf,
        "medium_confidence": medium_conf,
        "low_confidence": low_conf,
        "parser_version": "prompt19_7_v1",
        "elapsed_seconds": round(elapsed, 2),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sample_size": MAX_RECORDS,
    }
    
    with open(SUMMARY_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(json.dumps(summary, indent=2, ensure_ascii=True))

if __name__ == "__main__":
    main()
