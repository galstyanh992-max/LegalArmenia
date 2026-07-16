from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import os
import shutil
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path


CHUNK_SIZE = 10 * 1024 * 1024


@dataclass(frozen=True)
class ModelBlob:
    name: str
    url: str
    size: int
    sha256: str
    output: Path


MODELS = {
    "gte": ModelBlob(
        name="gte",
        url="https://huggingface.co/Alibaba-NLP/gte-multilingual-reranker-base/resolve/8215cf04918ba6f7b6a62bb44238ce2953d8831c/model.safetensors",
        size=611_934_706,
        sha256="10ebaa49322dd7e01a13a91c49810939e3f91f231aceaa47fdf0cab3083954f6",
        output=Path(r"D:\AI_MODELS\RERANKERS\gte\model.safetensors"),
    ),
    "bge": ModelBlob(
        name="bge",
        url="https://huggingface.co/BAAI/bge-reranker-v2-m3/resolve/953dc6f6f85a1b2dbfca4c34a2796e7dde08d41e/model.safetensors",
        size=2_271_071_852,
        sha256="d9e3e081faff1eefb84019509b2f5558fd74c1a05a2c7db22f74174fcedb5286",
        output=Path(r"D:\AI_MODELS\RERANKERS\bge\model.safetensors"),
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_part(blob: ModelBlob, part_dir: Path, index: int, start: int, end: int) -> Path:
    expected = end - start + 1
    path = part_dir / f"{index:04d}.part"
    if path.exists() and path.stat().st_size == expected:
        return path
    for attempt in range(4):
        request = urllib.request.Request(
            blob.url,
            headers={
                "Range": f"bytes={start}-{end}",
                "User-Agent": "legal-armenia-prompt19.2-pinned-model-downloader/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                content_range = response.headers.get("Content-Range", "")
                if response.status != 206 or not content_range.startswith(f"bytes {start}-{end}/"):
                    raise RuntimeError(f"server did not honor immutable byte range: {response.status} {content_range}")
                with path.open("wb") as output:
                    shutil.copyfileobj(response, output, length=1024 * 1024)
            if path.stat().st_size != expected:
                raise RuntimeError(f"short part {index}: {path.stat().st_size} != {expected}")
            return path
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def download(blob: ModelBlob, workers: int) -> None:
    blob.output.parent.mkdir(parents=True, exist_ok=True)
    if blob.output.exists() and blob.output.stat().st_size == blob.size and sha256(blob.output) == blob.sha256:
        print(f"{blob.name}: already verified", flush=True)
        return
    part_dir = blob.output.parent / ".model.safetensors.parts"
    part_dir.mkdir(exist_ok=True)
    ranges = []
    for index, start in enumerate(range(0, blob.size, CHUNK_SIZE)):
        ranges.append((index, start, min(blob.size - 1, start + CHUNK_SIZE - 1)))
    completed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_part, blob, part_dir, *item): item for item in ranges}
        for future in concurrent.futures.as_completed(futures):
            future.result()
            completed += 1
            if completed % 10 == 0 or completed == len(ranges):
                print(f"{blob.name}: {completed}/{len(ranges)} parts", flush=True)
    temporary = blob.output.with_suffix(".safetensors.assembling")
    with temporary.open("wb") as output:
        for index, _, _ in ranges:
            with (part_dir / f"{index:04d}.part").open("rb") as source:
                shutil.copyfileobj(source, output, length=8 * 1024 * 1024)
    if temporary.stat().st_size != blob.size:
        raise RuntimeError(f"{blob.name}: assembled size mismatch")
    digest = sha256(temporary)
    if digest != blob.sha256:
        raise RuntimeError(f"{blob.name}: SHA256 mismatch {digest}")
    os.replace(temporary, blob.output)
    print(f"{blob.name}: verified bytes={blob.size} sha256={digest}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("models", nargs="+", choices=sorted(MODELS))
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    workers = min(8, max(1, args.workers))
    for name in args.models:
        download(MODELS[name], workers)


if __name__ == "__main__":
    main()
