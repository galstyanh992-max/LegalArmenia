from __future__ import annotations

import hmac
import math
import os
import threading
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator


GTE_MODEL = "Alibaba-NLP/gte-multilingual-reranker-base"
GTE_REVISION = "8215cf04918ba6f7b6a62bb44238ce2953d8831c"
GTE_CODE_REVISION = "40ced75c3017eb27626c9d4ea981bde21a2662f4"
BGE_MODEL = "BAAI/bge-reranker-v2-m3"
BGE_REVISION = "953dc6f6f85a1b2dbfca4c34a2796e7dde08d41e"
APPROVED_MODELS = {GTE_MODEL: GTE_REVISION, BGE_MODEL: BGE_REVISION}


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        value = default
    return min(maximum, max(minimum, value))


@dataclass(frozen=True)
class Settings:
    model_id: str
    revision: str
    code_revision: str | None
    model_source: str
    api_key: str
    device: str
    max_candidates: int
    batch_size: int
    max_length: int
    max_query_chars: int
    max_candidate_chars: int
    eager_load: bool

    @classmethod
    def from_env(cls) -> "Settings":
        model_id = os.environ.get("RERANKER_MODEL_ID", GTE_MODEL)
        if model_id not in APPROVED_MODELS:
            raise RuntimeError("RERANKER_MODEL_ID is not an approved bake-off candidate")
        revision = os.environ.get("RERANKER_MODEL_REVISION", APPROVED_MODELS[model_id])
        if revision != APPROVED_MODELS[model_id]:
            raise RuntimeError("RERANKER_MODEL_REVISION must equal the approved immutable revision")
        expected_code_revision = GTE_CODE_REVISION if model_id == GTE_MODEL else None
        code_revision = os.environ.get("RERANKER_CODE_REVISION", expected_code_revision) or None
        if code_revision != expected_code_revision:
            required = GTE_CODE_REVISION if expected_code_revision else "unset"
            raise RuntimeError(f"RERANKER_CODE_REVISION must be {required} for the selected model")
        return cls(
            model_id=model_id,
            revision=revision,
            code_revision=code_revision,
            model_source=os.environ.get("RERANKER_MODEL_SOURCE", model_id),
            api_key=os.environ.get("RERANKER_API_KEY", ""),
            device=os.environ.get("RERANKER_DEVICE", "cpu"),
            max_candidates=_bounded_int("RERANKER_MAX_CANDIDATES", 100, 1, 100),
            batch_size=_bounded_int("RERANKER_BATCH_SIZE", 16, 1, 64),
            max_length=_bounded_int("RERANKER_MAX_LENGTH", 512, 64, 8192),
            max_query_chars=_bounded_int("RERANKER_MAX_QUERY_CHARS", 2000, 1, 4000),
            max_candidate_chars=_bounded_int("RERANKER_MAX_CANDIDATE_CHARS", 16000, 128, 64000),
            eager_load=os.environ.get("RERANKER_EAGER_LOAD", "true").lower() == "true",
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
    def clean_id(cls, value: str) -> str:
        if value != value.strip() or any(ord(char) < 32 for char in value):
            raise ValueError("candidate_id contains invalid whitespace/control characters")
        return value


class RerankRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=1)
    candidates: list[Candidate] = Field(min_length=1)

    @field_validator("query")
    @classmethod
    def clean_query(cls, value: str) -> str:
        value = value.replace("\x00", "").strip()
        if not value:
            raise ValueError("query must not be empty")
        return value

    @field_validator("candidates")
    @classmethod
    def unique_ids(cls, value: list[Candidate]) -> list[Candidate]:
        ids = [candidate.candidate_id for candidate in value]
        if len(ids) != len(set(ids)):
            raise ValueError("candidate_id values must be unique")
        return value


class RerankScore(BaseModel):
    candidate_id: str
    raw_score: float
    normalized_score: float


class RerankResponse(BaseModel):
    model: str
    model_revision: str
    max_length: int
    results: list[RerankScore]
    latency_ms: int


class ModelRuntime:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._tokenizer: Any = None
        self._model: Any = None
        self._torch: Any = None
        self._lock = threading.Lock()

    @property
    def ready(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        if self.ready:
            return
        with self._lock:
            if self.ready:
                return
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer

            torch.manual_seed(0)
            torch.set_grad_enabled(False)
            torch.use_deterministic_algorithms(True, warn_only=True)
            source = self.settings.model_source
            remote = not Path(source).exists()
            common: dict[str, Any] = {}
            if remote:
                common["revision"] = self.settings.revision
            if self.settings.code_revision:
                common["code_revision"] = self.settings.code_revision
            trust_remote_code = self.settings.model_id == GTE_MODEL
            tokenizer = AutoTokenizer.from_pretrained(source, trust_remote_code=trust_remote_code, **common)
            model = AutoModelForSequenceClassification.from_pretrained(
                source,
                trust_remote_code=trust_remote_code,
                torch_dtype=torch.float32,
                **common,
            )
            model.eval().to(self.settings.device)
            self._torch, self._tokenizer, self._model = torch, tokenizer, model

    def score(self, query: str, candidates: list[Candidate]) -> list[tuple[float, float]]:
        self.load()
        output: list[tuple[float, float]] = []
        pairs = [[query, candidate.text] for candidate in candidates]
        with self._lock, self._torch.inference_mode():
            for start in range(0, len(pairs), self.settings.batch_size):
                batch = pairs[start : start + self.settings.batch_size]
                encoded = self._tokenizer(
                    batch,
                    padding=True,
                    truncation=True,
                    max_length=self.settings.max_length,
                    return_tensors="pt",
                ).to(self.settings.device)
                logits = self._model(**encoded, return_dict=True).logits.reshape(-1).float().cpu().tolist()
                for raw in logits:
                    raw = float(raw)
                    normalized = 1.0 / (1.0 + math.exp(-max(-80.0, min(80.0, raw))))
                    if not math.isfinite(raw) or not math.isfinite(normalized):
                        raise RuntimeError("model returned a non-finite score")
                    output.append((raw, normalized))
        if len(output) != len(candidates):
            raise RuntimeError("model score count does not match candidate count")
        return output


def create_app(
    settings: Settings | None = None,
    score_override: Callable[[str, list[Candidate]], list[tuple[float, float]]] | None = None,
) -> FastAPI:
    cfg = settings or Settings.from_env()
    runtime = ModelRuntime(cfg)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if cfg.eager_load and score_override is None:
            runtime.load()
        yield

    app = FastAPI(title="Armenian Legal Reranker", version="1.0.0", lifespan=lifespan)

    def authenticate(authorization: str | None = Header(default=None)) -> None:
        if not cfg.api_key:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="service authentication is not configured")
        expected = f"Bearer {cfg.api_key}"
        if not authorization or not hmac.compare_digest(authorization, expected):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ready" if runtime.ready or score_override is not None else "loading",
            "model": cfg.model_id,
            "revision": cfg.revision,
            "code_revision": cfg.code_revision,
            "device": cfg.device,
            "max_candidates": cfg.max_candidates,
            "max_length": cfg.max_length,
        }

    @app.post("/rerank", response_model=RerankResponse, dependencies=[Depends(authenticate)])
    @app.post("/v1/rerank", response_model=RerankResponse, dependencies=[Depends(authenticate)])
    def rerank(body: RerankRequest) -> RerankResponse:
        started_at = time.perf_counter()
        if len(body.query) > cfg.max_query_chars:
            raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="query too large")
        if len(body.candidates) > cfg.max_candidates:
            raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="candidate batch too large")
        if any(len(candidate.text) > cfg.max_candidate_chars for candidate in body.candidates):
            raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="candidate text too large")
        scorer = score_override or runtime.score
        scores = scorer(body.query, body.candidates)
        if len(scores) != len(body.candidates):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="invalid model output")
        results: list[RerankScore] = []
        for candidate, (raw, normalized) in zip(body.candidates, scores, strict=True):
            if not math.isfinite(raw) or not math.isfinite(normalized) or normalized < 0 or normalized > 1:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="invalid model score")
            results.append(RerankScore(candidate_id=candidate.candidate_id, raw_score=raw, normalized_score=normalized))
        return RerankResponse(
            model=cfg.model_id,
            model_revision=cfg.revision,
            max_length=cfg.max_length,
            results=results,
            latency_ms=max(0, round((time.perf_counter() - started_at) * 1000)),
        )

    return app


app = create_app()
