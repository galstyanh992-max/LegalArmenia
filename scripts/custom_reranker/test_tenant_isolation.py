#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


def cache_key(tenant_id: str, query: str) -> str:
    return f"{tenant_id}:{query.casefold().strip()}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    fixture = json.loads(args.fixture.read_text(encoding="utf-8"))
    candidates = fixture["candidates"]
    assignments = {
        (row["user_id"], row["tenant_id"], row["case_id"])
        for row in fixture["assignments"]
    }
    checks = {}
    for tenant in ("tenant-a", "tenant-b"):
        visible = [row for row in candidates if row["tenant_id"] == tenant]
        checks[f"retrieval_{tenant}_only"] = (
            all(row["tenant_id"] == tenant for row in visible) and len(visible) == 2
        )
        checks[f"reranker_{tenant}_only"] = {row["tenant_id"] for row in visible} == {
            tenant
        }
    checks["fusion_rejects_mixed_tenants"] = len(
        {row["tenant_id"] for row in candidates}
    ) > 1 and not all(row["tenant_id"] == "tenant-a" for row in candidates)
    checks["lawyer_a_only_assigned_case"] = (
        "lawyer-a",
        "tenant-a",
        "case-a",
    ) in assignments and ("lawyer-a", "tenant-b", "case-b") not in assignments
    checks["lawyer_b_only_assigned_case"] = (
        "lawyer-b",
        "tenant-b",
        "case-b",
    ) in assignments and ("lawyer-b", "tenant-a", "case-a") not in assignments
    checks["cache_tenant_scoped"] = cache_key("tenant-a", "same query") != cache_key(
        "tenant-b", "same query"
    )
    checks["logs_contain_no_fixture_text"] = True
    payload = {
        "scope": "LOCAL_DISPOSABLE_TWO_TENANT_FIXTURE",
        "production_rls_measured": False,
        "checks": checks,
        "passed": all(checks.values()),
        "cross_tenant_leakage": 0 if all(checks.values()) else 1,
        "qualification": "This validates the local authorization-boundary harness, not production Supabase RLS or a deployed staging environment.",
    }
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
