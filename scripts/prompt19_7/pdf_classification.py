#!/usr/bin/env python3
"""Phase 2 - PDF Classification

Classifies a statistical sample of PDFs as TEXT_BASED, SCANNED, MIXED, ENCRYPTED, CORRUPTED, EMPTY.
Uses PyMuPDF (fitz) for fast page count, text layer, bookmark, and metadata detection.
"""
import json, os, sys, random, time, hashlib
from pathlib import Path
from datetime import datetime, timezone

try:
    import fitz
except ImportError:
    print("ERROR: PyMuPDF (fitz) not installed")
    sys.exit(1)

SOURCE_ROOT = Path(r"D:\arlis_pdfs1")
OUTPUT_DIR = Path(r"D:\1V\LegalArmenia-prompt19-7\AUDIT_REPORTS\artifacts")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

INVENTORY_PATH = OUTPUT_DIR / "source_inventory.jsonl"
SAMPLE_SIZE = 2000
SEED = 42

def classify_pdf(path, max_pages_check=10):
    result = {
        "source_file_id": "",
        "pdf_type": "UNKNOWN",
        "page_count": 0,
        "text_layer": False,
        "bookmarks": False,
        "toc_detected": False,
        "page_labels": False,
        "printed_page_numbers_detected": False,
        "tables_detected": False,
        "articles_detected": False,
        "ocr_required": False,
        "metadata": {},
        "text_chars_total": 0,
        "text_chars_per_page_avg": 0.0,
        "error": None
    }
    try:
        doc = fitz.open(str(path))
        result["page_count"] = doc.page_count
        if doc.page_count == 0:
            result["pdf_type"] = "EMPTY"
            doc.close()
            return result

        # Check encryption
        if doc.is_encrypted:
            result["pdf_type"] = "ENCRYPTED"
            doc.close()
            return result

        # Bookmarks/TOC
        toc = doc.get_toc()
        result["bookmarks"] = len(toc) > 0
        result["toc_detected"] = len(toc) > 0

        # Metadata
        meta = doc.metadata or {}
        result["metadata"] = {k: v for k, v in meta.items() if v}

        # Sample pages for text layer
        pages_to_check = min(doc.page_count, max_pages_check)
        text_chars = 0
        pages_with_text = 0
        pages_without_text = 0
        has_article_markers = False

        article_patterns = ["հոդված", "հոդվածի", "статья", "Article"]
        table_indicators = 0

        for i in range(pages_to_check):
            page = doc[i]
            text = page.get_text("text")
            chars = len(text.strip())
            text_chars += chars
            if chars > 50:
                pages_with_text += 1
            else:
                pages_without_text += 1

            # Check for article structure
            for pat in article_patterns:
                if pat in text:
                    has_article_markers = True
                    break

            # Simple table detection (multiple tab characters or aligned columns)
            if text.count("\t") > 5:
                table_indicators += 1

        result["text_chars_total"] = text_chars
        result["text_chars_per_page_avg"] = text_chars / pages_to_check if pages_to_check > 0 else 0
        result["articles_detected"] = has_article_markers
        result["tables_detected"] = table_indicators > 2

        # Classification
        if pages_without_text == 0:
            result["pdf_type"] = "TEXT_BASED"
            result["text_layer"] = True
        elif pages_with_text == 0:
            result["pdf_type"] = "SCANNED"
            result["text_layer"] = False
            result["ocr_required"] = True
        else:
            result["pdf_type"] = "MIXED"
            result["text_layer"] = True
            result["ocr_required"] = pages_without_text > 0

        doc.close()
    except Exception as e:
        result["pdf_type"] = "CORRUPTED"
        result["error"] = str(e)[:200]

    return result


def main():
    start = time.time()
    output_jsonl = OUTPUT_DIR / "pdf_classification_sample.jsonl"
    summary_path = OUTPUT_DIR / "pdf_classification_summary.json"

    # Load inventory to get PDF file list
    pdf_files = []
    with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            if rec["extension"] == ".pdf" and not rec["empty"]:
                pdf_files.append(rec)

    total_pdfs = len(pdf_files)
    print(f"Total non-empty PDFs: {total_pdfs}")

    # Sample
    random.seed(SEED)
    sample = random.sample(pdf_files, min(SAMPLE_SIZE, total_pdfs))

    results = []
    type_counts = {"TEXT_BASED": 0, "SCANNED": 0, "MIXED": 0, "ENCRYPTED": 0, "CORRUPTED": 0, "EMPTY": 0}
    text_layer_yes = 0
    text_layer_no = 0
    ocr_required_count = 0
    bookmarks_count = 0
    toc_count = 0
    articles_count = 0
    tables_count = 0
    page_counts = []
    errors = []

    for i, rec in enumerate(sample):
        path = Path(rec["absolute_path"])
        cls = classify_pdf(path)
        cls["source_file_id"] = rec["source_file_id"]
        cls["filename"] = rec["filename"]
        cls["relative_path"] = rec["relative_path"]
        results.append(cls)

        pdf_type = cls["pdf_type"]
        type_counts[pdf_type] = type_counts.get(pdf_type, 0) + 1
        if cls["text_layer"]:
            text_layer_yes += 1
        else:
            text_layer_no += 1
        if cls["ocr_required"]:
            ocr_required_count += 1
        if cls["bookmarks"]:
            bookmarks_count += 1
        if cls["toc_detected"]:
            toc_count += 1
        if cls["articles_detected"]:
            articles_count += 1
        if cls["tables_detected"]:
            tables_count += 1
        if cls["page_count"] > 0:
            page_counts.append(cls["page_count"])
        if cls["error"]:
            errors.append({"file": rec["relative_path"], "error": cls["error"]})

        if (i + 1) % 200 == 0:
            print(f"  Classified {i+1}/{len(sample)}...")

    with open(output_jsonl, "w", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    elapsed = time.time() - start
    avg_pages = sum(page_counts) / len(page_counts) if page_counts else 0
    median_pages = sorted(page_counts)[len(page_counts)//2] if page_counts else 0

    summary = {
        "sample_size": len(sample),
        "total_pdfs_in_corpus": total_pdfs,
        "type_distribution": type_counts,
        "text_layer_yes": text_layer_yes,
        "text_layer_no": text_layer_no,
        "ocr_required": ocr_required_count,
        "bookmarks": bookmarks_count,
        "toc_detected": toc_count,
        "articles_detected": articles_count,
        "tables_detected": tables_count,
        "avg_pages": round(avg_pages, 1),
        "median_pages": median_pages,
        "max_pages": max(page_counts) if page_counts else 0,
        "min_pages": min(page_counts) if page_counts else 0,
        "errors": len(errors),
        "error_samples": errors[:10],
        "elapsed_seconds": round(elapsed, 2),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "output_file": str(output_jsonl),
        # Extrapolation
        "estimated_text_based_pct": round(type_counts["TEXT_BASED"] / len(sample) * 100, 1),
        "estimated_scanned_pct": round(type_counts["SCANNED"] / len(sample) * 100, 1),
        "estimated_mixed_pct": round(type_counts["MIXED"] / len(sample) * 100, 1),
        "estimated_ocr_needed": round(type_counts["SCANNED"] / len(sample) * total_pdfs),
    }

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    # Safe print (ASCII only)
    safe = {k: v for k, v in summary.items() if k != "error_samples"}
    print(json.dumps(safe, indent=2, ensure_ascii=True))

if __name__ == "__main__":
    main()
