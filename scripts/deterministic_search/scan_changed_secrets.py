#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


PATTERNS = {
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "jwt": re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}"),
    "supabase_secret": re.compile(r"\bsb_secret_[A-Za-z0-9_-]{20,}"),
    "cloudflare_token": re.compile(
        r"(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[:=]\s*['\"]?[A-Za-z0-9_-]{30,}"
    ),
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    raw = subprocess.check_output(
        ["git", "status", "--porcelain=v1", "-z"], cwd=args.root
    ).decode("utf-8", errors="replace")
    paths = []
    for entry in raw.split("\0"):
        if not entry:
            continue
        path = entry[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        paths.append(path)
    findings = []
    for rel in paths:
        path = args.root / rel
        if not path.is_file() or rel.endswith("scan_changed_secrets.py"):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for name, pattern in PATTERNS.items():
            if pattern.search(text):
                findings.append({"path": rel.replace("\\", "/"), "pattern": name})
    env_paths = [p for p in paths if Path(p).name.startswith(".env")]
    result = {
        "scanned_file_count": len(paths),
        "findings": findings,
        "committed_secret_findings": len(findings),
        "env_files_in_diff": env_paths,
        "passed": not findings and not env_paths,
    }
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if not result["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
