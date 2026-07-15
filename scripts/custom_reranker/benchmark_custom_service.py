#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


class ProcessMemoryCounters(ctypes.Structure):
    _fields_ = [
        ("cb", ctypes.c_ulong),
        ("PageFaultCount", ctypes.c_ulong),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
    ]


def working_set_bytes() -> int:
    counters = ProcessMemoryCounters()
    counters.cb = ctypes.sizeof(counters)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    psapi = ctypes.WinDLL("psapi", use_last_error=True)
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    psapi.GetProcessMemoryInfo.argtypes = [
        wintypes.HANDLE,
        ctypes.POINTER(ProcessMemoryCounters),
        wintypes.DWORD,
    ]
    psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
    handle = kernel32.GetCurrentProcess()
    if not psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb):
        raise OSError("GetProcessMemoryInfo failed")
    return int(counters.WorkingSetSize)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--service", type=Path, required=True)
    parser.add_argument("--head", type=Path, required=True)
    parser.add_argument("--pool", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    import sys

    sys.path.insert(0, str(args.service))
    from app import Candidate, Runtime, Settings

    head_sha = hashlib.sha256(args.head.read_bytes()).hexdigest()
    settings = Settings(
        api_key="local-only",
        head_path=args.head,
        head_sha256=head_sha,
        max_candidates=20,
        batch_size=16,
        max_length=128,
    )
    runtime = Runtime(settings)
    began = time.perf_counter()
    runtime.load()
    startup_ms = (time.perf_counter() - began) * 1000
    memory = working_set_bytes()
    pool = json.loads(args.pool.read_text(encoding="utf-8").splitlines()[0])
    query = pool["query"]

    def make_candidates(count: int):
        return [
            Candidate(
                candidate_id=row["candidate_id"],
                text=row["text"],
                trusted_metadata=row["trusted_metadata"],
            )
            for row in pool["candidates"][:count]
        ]

    results = {}
    for count in (10, 20):
        candidates = make_candidates(count)
        runtime.score(query, candidates)
        durations = []
        for _ in range(12):
            started = time.perf_counter()
            values = runtime.score(query, candidates)
            durations.append((time.perf_counter() - started) * 1000)
            assert len(values) == count
        results[str(count)] = {
            "requests": 12,
            "p50_ms": statistics.median(durations),
            "p95_ms": sorted(durations)[10],
            "p99_ms": max(durations),
            "throughput_rps": 1000 / statistics.fmean(durations),
            "errors": 0,
        }
    candidates = make_candidates(10)
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=4) as executor:
        concurrent = list(
            executor.map(lambda _: runtime.score(query, candidates), range(12))
        )
    concurrent_ms = (time.perf_counter() - started) * 1000
    payload = {
        "hardware": {
            "cpu": "Intel Xeon E5-2699 v3",
            "physical_cores": 18,
            "logical_processors": 36,
            "gpu": None,
            "dtype": "float32",
        },
        "base_model": settings.head_path.name,
        "head_sha256": head_sha,
        "startup_ms": startup_ms,
        "working_set_bytes": memory,
        "candidate_counts": results,
        "concurrency_4": {
            "requests": 12,
            "successful": sum(len(row) == 10 for row in concurrent),
            "elapsed_ms": concurrent_ms,
            "throughput_rps": 12_000 / concurrent_ms,
        },
        "cost_per_query_usd_local": 0.0,
    }
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
