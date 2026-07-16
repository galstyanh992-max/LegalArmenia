#!/usr/bin/env python3
"""Phase 1 - Source Corpus Inventory for D:\arlis_pdfs1"""
import hashlib, json, os, time
from pathlib import Path
from datetime import datetime, timezone

SOURCE_ROOT = Path(r"D:\arlis_pdfs1")
OUTPUT_DIR = Path(r"D:\1V\LegalArmenia-prompt19-7\AUDIT_REPORTS\artifacts")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SUPPORTED_EXTS = {".pdf",".json",".jsonl",".txt",".html",".htm",".xml",".csv",".tsv",".md",".docx"}
HASH_CHUNK = 1024*1024

def sha256_file(path):
    h = hashlib.sha256()
    with open(path,"rb") as f:
        while True:
            chunk = f.read(HASH_CHUNK)
            if not chunk: break
            h.update(chunk)
    return h.hexdigest()

def guess_language(filename):
    fn = filename.lower()
    langs = []
    if any(0x0530 <= ord(c) <= 0x058F for c in fn): langs.append("hy")
    if any(0x0400 <= ord(c) <= 0x04FF for c in fn): langs.append("ru")
    if not langs: langs.append("unknown")
    return langs

def guess_source_family(filename):
    fn = filename.lower()
    if "echr" in fn or "european" in fn: return "ECHR"
    if "constitutional" in fn: return "constitutional_court"
    if "cassation" in fn: return "court_cassation"
    if "government" in fn: return "government_decision"
    if "minister" in fn: return "ministerial_act"
    if "law" in fn or "code" in fn: return "law_code"
    if "yerevan" in fn or "municipal" in fn: return "municipal"
    if "president" in fn: return "presidential"
    return "arlis_general"

def inventory_file(path, rel_path):
    stat = path.stat()
    ext = path.suffix.lower()
    record = {
        "source_file_id":"","absolute_path":str(path),"relative_path":rel_path,
        "filename":path.name,"extension":ext,"size_bytes":stat.st_size,
        "sha256":"","modified_at":datetime.fromtimestamp(stat.st_mtime,tz=timezone.utc).isoformat(),
        "language_guess":guess_language(path.name),"source_family":guess_source_family(path.name),
        "readable":True,"encrypted":False,"corrupted":False,"empty":stat.st_size==0,
        "text_available":ext in {".txt",".json",".jsonl",".csv",".tsv",".md",".html",".htm",".xml"},
        "metadata_available":ext in {".json",".jsonl",".xml",".csv",".tsv",".md"}
    }
    try:
        record["sha256"] = sha256_file(path)
        record["source_file_id"] = "sf_" + record["sha256"][:16]
    except Exception:
        record["readable"]=False; record["corrupted"]=True; record["sha256"]=""
        record["source_file_id"]="sf_err_"+str(abs(hash(str(path)))%(10**14))
    return record

def main():
    start=time.time()
    files_jsonl=OUTPUT_DIR/"source_inventory.jsonl"
    summary_path=OUTPUT_DIR/"source_inventory_summary.json"
    total=0;by_format={};by_folder={};by_family={};by_language={}
    sha_seen={};duplicates=[];unreadable=0;corrupted=0;encrypted=0;empty=0;total_bytes=0
    all_files=[]
    for root,dirs,filenames in os.walk(SOURCE_ROOT):
        rel_root=os.path.relpath(root,SOURCE_ROOT)
        top_folder=rel_root.split(os.sep)[0] if rel_root!="." else "(root)"
        for fn in sorted(filenames):
            path=Path(root)/fn
            rel_path=os.path.relpath(str(path),str(SOURCE_ROOT))
            record=inventory_file(path,rel_path)
            all_files.append(record)
            total+=1;total_bytes+=record["size_bytes"]
            ext=record["extension"]
            by_format[ext]=by_format.get(ext,0)+1
            by_folder[top_folder]=by_folder.get(top_folder,0)+1
            by_family[record["source_family"]]=by_family.get(record["source_family"],0)+1
            for lang in record["language_guess"]:by_language[lang]=by_language.get(lang,0)+1
            if not record["readable"]:unreadable+=1
            if record["corrupted"]:corrupted+=1
            if record["encrypted"]:encrypted+=1
            if record["empty"]:empty+=1
            sha=record["sha256"]
            if sha:
                if sha in sha_seen:duplicates.append({"sha256":sha,"files":[sha_seen[sha],record["relative_path"]]})
                else:sha_seen[sha]=record["relative_path"]
    with open(files_jsonl,"w",encoding="utf-8") as f:
        for rec in all_files:f.write(json.dumps(rec,ensure_ascii=False)+"\n")
    elapsed=time.time()-start
    summary={
        "source_root":str(SOURCE_ROOT),"total_files":total,"total_bytes":total_bytes,
        "total_mb":round(total_bytes/(1024*1024),2),"by_format":by_format,"by_folder":by_folder,
        "by_family":by_family,"by_language":by_language,"sha_duplicates":len(duplicates),
        "duplicate_groups":duplicates[:100],"unreadable":unreadable,"corrupted":corrupted,
        "encrypted":encrypted,"empty":empty,"elapsed_seconds":round(elapsed,2),
        "generated_at":datetime.now(timezone.utc).isoformat(),"output_file":str(files_jsonl)
    }
    with open(summary_path,"w",encoding="utf-8") as f:json.dump(summary,f,indent=2,ensure_ascii=False)
    print(json.dumps(summary,indent=2,ensure_ascii=False))

if __name__=="__main__":main()
