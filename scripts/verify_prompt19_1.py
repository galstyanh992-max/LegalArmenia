"""Static Prompt 19.1 verifier; writes machine-readable scan artifacts."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "AUDIT_REPORTS" / "artifacts"
RUNTIME_FILES = [
    "supabase/functions/vector-search/index.ts",
    "supabase/functions/kb-search/index.ts",
    "supabase/functions/kb-search-assistant/index.ts",
    "supabase/functions/kb-unified-search/index.ts",
    "supabase/functions/_shared/rag-search.ts",
    "supabase/functions/_shared/rag-types.ts",
]
FRONTEND_FILES = [
    "src/hooks/useKnowledgeBase.ts",
    "src/hooks/useLegalPracticeKB.ts",
    "src/components/kb/KBSearchPanel.tsx",
]


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True, encoding="utf-8", errors="replace")


def main() -> None:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    qwen_refs = []
    for rel in RUNTIME_FILES:
        text = (ROOT / rel).read_text(encoding="utf-8")
        if "search_legal_corpus_dual" in text or "p_qwen_embedding" in text or "p_qwen_limit" in text:
            failures.append(f"legacy retrieval request remains: {rel}")
        for line_number, line in enumerate(text.splitlines(), 1):
            if "qwen" in line.lower():
                qwen_refs.append({"file": rel, "line": line_number, "text": line.strip()})
                if "legacy_qwen_used" not in line:
                    failures.append(f"unapproved Qwen runtime reference: {rel}:{line_number}")
        if "reranker_ok: false" not in text and rel.endswith("index.ts"):
            failures.append(f"truthful reranker telemetry missing: {rel}")

    for rel in FRONTEND_FILES:
        text = (ROOT / rel).read_text(encoding="utf-8")
        if "search_legal_corpus_dual" in text or "search_legal_corpus_metric" in text:
            failures.append(f"browser directly references corpus RPC: {rel}")
        if "functions.invoke" not in text:
            failures.append(f"browser Edge route missing: {rel}")

    migration = (ROOT / "supabase/migrations/20260714165009_metric_only_rpc_unknown_scope.sql").read_text(encoding="utf-8")
    function_body = migration[
        migration.index("create or replace function public.search_legal_corpus_metric"):
        migration.index("comment on function public.search_legal_corpus_metric")
    ].lower()
    required_sql = [
        "security invoker", "set search_path = public, extensions, pg_temp",
        "set statement_timeout = '60s'", "v_limit > 50", "v_ann_limit > 200",
        "v_fts_limit > 100", "to service_role", "from public, anon, authenticated",
    ]
    for token in required_sql:
        if token not in migration.lower():
            failures.append(f"migration token missing: {token}")
    if "qwen" in function_body or "return query execute" in function_body:
        failures.append("new RPC contains Qwen or dynamic SQL")

    changed = sorted(set(git("diff", "--name-only").splitlines()) | set(git("ls-files", "--others", "--exclude-standard").splitlines()))
    env_diff = [path for path in changed if Path(path).name.startswith(".env")]
    if env_diff:
        failures.append(".env file present in diff")

    diff = git("diff", "--no-ext-diff", "--unified=0")
    untracked_text = "\n".join(
        (ROOT / path).read_text(encoding="utf-8", errors="replace")
        for path in changed
        if (ROOT / path).is_file() and path not in git("diff", "--name-only").splitlines()
    )
    scan_text = diff + "\n" + untracked_text
    secret_patterns = {
        "private_key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        "openai_key": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
        "supabase_secret": re.compile(r"\bsb_secret_[A-Za-z0-9_-]{20,}\b"),
        "jwt": re.compile(r"\beyJhbGciOi[A-Za-z0-9._-]{40,}\b"),
    }
    secret_hits = {name: len(pattern.findall(scan_text)) for name, pattern in secret_patterns.items()}
    if any(secret_hits.values()):
        failures.append("possible secret material found in diff")

    migration_files = sorted(path.name for path in (ROOT / "supabase/migrations").glob("*.sql"))
    unexpected_local = [
        name for name in migration_files
        if name not in {
            "20260712120002_versioned_baseline_20260712.sql",
            "20260712120004_harden_case_document_authorization.sql",
            "20260712120006_harden_profile_role_authorization.sql",
            "20260712120008_enforce_case_files_bucket_constraints.sql",
            "20260712120010_enforce_audio_transcription_idempotency.sql",
            "20260713221836_restore_cases_insert_trigger.sql",
            "20260713222445_isolate_legacy_media_reads.sql",
            "20260713222818_align_audio_transcription_read_access.sql",
            "20260714165009_metric_only_rpc_unknown_scope.sql",
        }
    ]
    if unexpected_local:
        failures.append(f"unexpected local migrations: {unexpected_local}")

    qwen_artifact = {
        "scan_scope": RUNTIME_FILES,
        "approved_compatibility_field": "legacy_qwen_used=false",
        "references": qwen_refs,
        "unapproved_reference_count": sum(1 for ref in qwen_refs if "legacy_qwen_used" not in ref["text"]),
    }
    (ARTIFACTS / "prompt19_1_qwen_runtime_scan.json").write_text(
        json.dumps(qwen_artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    result = {
        "ok": not failures,
        "failures": failures,
        "changed_file_count": len(changed),
        "env_files_in_diff": env_diff,
        "secret_hits": secret_hits,
        "unexpected_local_migrations": unexpected_local,
        "known_remote_only_baseline_migrations": ["20260714110215_repair_metric_retrieval_quality"],
        "migration_sha256": hashlib.sha256(migration.encode("utf-8")).hexdigest(),
    }
    (ARTIFACTS / "prompt19_1_static_verifier.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
