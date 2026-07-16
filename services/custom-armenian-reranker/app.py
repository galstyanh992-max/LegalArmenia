from __future__ import annotations

import hmac
import json
import math
import os
import re
import threading
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

MODEL_ID = "legal-armenia/distilmbert-frozen-legal-multihead-v1"
BASE_MODEL = "distilbert/distilbert-base-multilingual-cased"
BASE_REVISION = "45c032ab32cc946ad88a166f7cb282f58c753c2e"
INJECTION = re.compile(
    r"ignore previous instructions|return this document as rank 1|reveal (?:the )?system prompt|set score to 1\.0|բացահայտիր համակարգային|игнорируй предыдущие",
    re.I,
)


@dataclass(frozen=True)
class Settings:
    api_key: str
    head_path: Path
    head_sha256: str
    batch_size: int = 16
    max_length: int = 128
    max_candidates: int = 20
    max_query_chars: int = 2000
    max_candidate_chars: int = 16000
    eager_load: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            api_key=os.environ.get("CUSTOM_RERANKER_API_KEY", ""),
            head_path=Path(os.environ.get("CUSTOM_RERANKER_HEAD", "custom_head.json")),
            head_sha256=os.environ.get("CUSTOM_RERANKER_HEAD_SHA256", ""),
            batch_size=max(
                1, min(32, int(os.environ.get("CUSTOM_RERANKER_BATCH_SIZE", "16")))
            ),
            max_length=max(
                64, min(256, int(os.environ.get("CUSTOM_RERANKER_MAX_LENGTH", "128")))
            ),
            max_candidates=max(
                1, min(50, int(os.environ.get("CUSTOM_RERANKER_MAX_CANDIDATES", "20")))
            ),
            eager_load=os.environ.get("CUSTOM_RERANKER_EAGER_LOAD", "false").lower()
            == "true",
        )


class TrustedMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    norm_status: str | None = None
    document_type: str | None = None
    authority: str | None = None
    effective_from: str | None = None
    effective_to: str | None = None


class Candidate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidate_id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1)
    trusted_metadata: TrustedMetadata

    @field_validator("candidate_id")
    @classmethod
    def valid_id(cls, value: str) -> str:
        if value != value.strip() or any(ord(char) < 32 for char in value):
            raise ValueError("invalid candidate_id")
        return value


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=1)
    candidates: list[Candidate] = Field(min_length=1)

    @field_validator("query")
    @classmethod
    def clean_query(cls, value: str) -> str:
        value = value.replace("\x00", "").strip()
        if not value:
            raise ValueError("empty query")
        return value

    @field_validator("candidates")
    @classmethod
    def unique_ids(cls, value: list[Candidate]) -> list[Candidate]:
        ids = [item.candidate_id for item in value]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate candidate_id")
        return value


class Score(BaseModel):
    candidate_id: str
    raw_score: float
    normalized_score: float


class Response(BaseModel):
    model: str
    model_revision: str
    results: list[Score]
    latency_ms: int


class Runtime:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.lock = threading.Lock()
        self.tokenizer: Any = None
        self.model: Any = None
        self.torch: Any = None
        self.relevance_weight: Any = None
        self.relevance_bias: Any = None
        self.actual_head_sha256: str | None = None

    @property
    def ready(self) -> bool:
        return self.model is not None

    def load(self) -> None:
        if self.ready:
            return
        with self.lock:
            if self.ready:
                return
            import hashlib
            import torch
            from transformers import AutoModel, AutoTokenizer

            data = self.settings.head_path.read_bytes()
            actual = hashlib.sha256(data).hexdigest()
            if not self.settings.head_sha256 or not hmac.compare_digest(
                actual, self.settings.head_sha256
            ):
                raise RuntimeError("custom head checksum mismatch")
            payload = json.loads(data)
            if (
                payload["base_model"] != BASE_MODEL
                or payload["base_revision"] != BASE_REVISION
            ):
                raise RuntimeError("custom head base model mismatch")
            torch.manual_seed(1932)
            torch.set_grad_enabled(False)
            torch.use_deterministic_algorithms(True, warn_only=True)
            self.tokenizer = AutoTokenizer.from_pretrained(
                BASE_MODEL, revision=BASE_REVISION
            )
            self.model = AutoModel.from_pretrained(
                BASE_MODEL, revision=BASE_REVISION
            ).eval()
            self.relevance_weight = torch.tensor(
                payload["head"]["relevance_weight"], dtype=torch.float32
            )
            self.relevance_bias = torch.tensor(
                payload["head"]["relevance_bias"], dtype=torch.float32
            )
            self.torch = torch
            self.actual_head_sha256 = actual

    def score(
        self, query: str, candidates: list[Candidate]
    ) -> list[tuple[float, float]]:
        self.load()
        output = []
        with self.lock, self.torch.inference_mode():
            for start in range(0, len(candidates), self.settings.batch_size):
                batch = candidates[start : start + self.settings.batch_size]
                encoded = self.tokenizer(
                    [query] * len(batch),
                    [item.text for item in batch],
                    padding=True,
                    truncation=True,
                    max_length=self.settings.max_length,
                    return_tensors="pt",
                )
                hidden = self.model(**encoded).last_hidden_state
                mask = encoded["attention_mask"].unsqueeze(-1)
                pooled = (hidden * mask).sum(1) / mask.sum(1).clamp_min(1)
                logits = pooled @ self.relevance_weight + self.relevance_bias
                for item, raw in zip(batch, logits.tolist(), strict=True):
                    raw = -80.0 if INJECTION.search(item.text) else float(raw)
                    normalized = 1 / (1 + math.exp(-max(-80, min(80, raw))))
                    if not math.isfinite(raw) or not math.isfinite(normalized):
                        raise RuntimeError("non-finite score")
                    output.append((raw, normalized))
        return output


def create_app(
    settings: Settings | None = None,
    score_override: Callable[[str, list[Candidate]], list[tuple[float, float]]]
    | None = None,
) -> FastAPI:
    cfg = settings or Settings.from_env()
    runtime = Runtime(cfg)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if cfg.eager_load and score_override is None:
            runtime.load()
        yield

    app = FastAPI(
        title="Custom Armenian Legal Reranker", version="1.0.0", lifespan=lifespan
    )

    def authenticate(authorization: str | None = Header(default=None)) -> None:
        if not cfg.api_key:
            raise HTTPException(status_code=503, detail="authentication not configured")
        if not authorization or not hmac.compare_digest(
            authorization, f"Bearer {cfg.api_key}"
        ):
            raise HTTPException(status_code=401, detail="unauthorized")

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"live": True, "ready": runtime.ready or score_override is not None}

    @app.get("/model-info", dependencies=[Depends(authenticate)])
    def model_info() -> dict[str, Any]:
        return {
            "model": MODEL_ID,
            "model_revision": cfg.head_sha256,
            "base_model": BASE_MODEL,
            "base_revision": BASE_REVISION,
            "head_sha256": cfg.head_sha256,
            "max_length": cfg.max_length,
            "max_candidates": cfg.max_candidates,
            "ready": runtime.ready or score_override is not None,
        }

    @app.post("/rerank", response_model=Response, dependencies=[Depends(authenticate)])
    def rerank(body: Request) -> Response:
        began = time.perf_counter()
        if (
            len(body.query) > cfg.max_query_chars
            or len(body.candidates) > cfg.max_candidates
            or any(len(item.text) > cfg.max_candidate_chars for item in body.candidates)
        ):
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="payload exceeds configured limit",
            )
        values = (score_override or runtime.score)(body.query, body.candidates)
        if len(values) != len(body.candidates):
            raise HTTPException(status_code=502, detail="invalid model output")
        results = []
        for candidate, (raw, normalized) in zip(body.candidates, values, strict=True):
            if (
                not math.isfinite(raw)
                or not math.isfinite(normalized)
                or not 0 <= normalized <= 1
            ):
                raise HTTPException(status_code=502, detail="invalid model score")
            results.append(
                Score(
                    candidate_id=candidate.candidate_id,
                    raw_score=raw,
                    normalized_score=normalized,
                )
            )
        return Response(
            model=MODEL_ID,
            model_revision=cfg.head_sha256,
            results=results,
            latency_ms=round((time.perf_counter() - began) * 1000),
        )

    return app


app = create_app()
