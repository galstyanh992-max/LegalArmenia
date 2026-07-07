"""
Preview embedding server for legal_unit_v1.

Endpoints:
  GET  /health
  POST /embed {"texts":[...], "model":"metric-ai-armenian", "input_type":"passage"|"query"}
  POST /embed/query   {"texts":[...]}  # Metric compatibility
  POST /embed/passage {"texts":[...]}  # Metric compatibility
"""

from __future__ import annotations

import os
import threading
from typing import Dict, List, Literal, Sequence

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

METRIC_ALIAS = "metric-ai-armenian"
QWEN_ALIAS = "qwen3-embedding-0.6b"
ENABLE_QWEN_FALLBACK = os.environ.get("ENABLE_QWEN_FALLBACK") == "1"
MODEL_IDS = {
    METRIC_ALIAS: os.environ.get(
        "METRIC_EMBEDDING_MODEL",
        "Metric-AI/armenian-text-embeddings-2-large",
    )
}
EXPECTED_DIMS = {
    METRIC_ALIAS: int(os.environ.get("METRIC_EMBEDDING_DIM", "1024")),
}
API_KEY = os.environ.get("EMBEDDING_API_KEY")

if ENABLE_QWEN_FALLBACK:
    MODEL_IDS[QWEN_ALIAS] = os.environ.get(
        "QWEN_EMBEDDING_MODEL",
        "Qwen/Qwen3-Embedding-0.6B",
    )
    EXPECTED_DIMS[QWEN_ALIAS] = int(os.environ.get("QWEN_EMBEDDING_DIM", "1024"))

app = FastAPI(title="AI Legal Armenia dual embedding preview", version="1.0")


class EmbedRequest(BaseModel):
    texts: str | List[str]
    model: str = METRIC_ALIAS
    input_type: Literal["passage", "query"] = "passage"


class ModelRuntime:
    def __init__(self, alias: str):
        self.alias = alias
        self.model_id = MODEL_IDS[alias]
        self.expected_dim = EXPECTED_DIMS[alias]
        self.max_len = int(os.environ.get("EMBEDDING_MAXLEN", "512"))
        self.device = os.environ.get("EMBEDDING_DEVICE")
        self._lock = threading.Lock()
        self._loaded = False
        self._torch = None
        self._tokenizer = None
        self._model = None

    def load(self):
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            import torch
            from transformers import AutoModel, AutoTokenizer

            self._torch = torch
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.model_id,
                trust_remote_code=True,
            )
            self._model = AutoModel.from_pretrained(
                self.model_id,
                trust_remote_code=True,
            )
            self._model.eval()
            self.device = self.device or ("cuda" if torch.cuda.is_available() else "cpu")
            self._model.to(self.device)
            dim = int(self._model.config.hidden_size)
            if dim != self.expected_dim:
                raise RuntimeError(
                    f"{self.model_id} dimension {dim} != expected {self.expected_dim}"
                )
            self._loaded = True

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def dimension(self) -> int:
        self.load()
        return int(self._model.config.hidden_size)

    def encode(self, texts: Sequence[str], input_type: str) -> List[List[float]]:
        self.load()
        prefix = self.prefix(input_type)
        prepared = [prefix + clean(text) for text in texts]
        out: List[List[float]] = []
        torch = self._torch
        batch_size = int(os.environ.get("EMBEDDING_BATCH", "8"))
        with torch.no_grad():
            for i in range(0, len(prepared), batch_size):
                batch = prepared[i : i + batch_size]
                enc = self._tokenizer(
                    batch,
                    padding=True,
                    truncation=True,
                    max_length=self.max_len,
                    return_tensors="pt",
                ).to(self.device)
                model_out = self._model(**enc)
                hidden = model_out.last_hidden_state
                mask = enc["attention_mask"].unsqueeze(-1).type_as(hidden)
                emb = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
                emb = torch.nn.functional.normalize(emb, p=2, dim=1)
                out.extend(emb.cpu().tolist())
        return out

    def prefix(self, input_type: str) -> str:
        if self.alias == METRIC_ALIAS:
            return "query: " if input_type == "query" else "passage: "
        if self.alias == QWEN_ALIAS and input_type == "query":
            return "Instruct: Retrieve legally relevant passages\nQuery: "
        return ""


def clean(text: str) -> str:
    return (text or "").replace("\x00", "").strip()


def as_list(texts: str | List[str]) -> List[str]:
    return [texts] if isinstance(texts, str) else texts


def check_auth(x_api_key: str | None) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")


runtimes: Dict[str, ModelRuntime] = {
    alias: ModelRuntime(alias) for alias in MODEL_IDS
}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "primary_route": METRIC_ALIAS,
        "qwen_optional_fallback_enabled": ENABLE_QWEN_FALLBACK,
        "models": {
            alias: {
                "model": runtime.model_id,
                "dimension": runtime.expected_dim,
                "loaded": runtime.loaded,
            }
            for alias, runtime in runtimes.items()
        },
    }


@app.post("/embed")
def embed(req: EmbedRequest, x_api_key: str | None = Header(default=None)):
    check_auth(x_api_key)
    try:
        if req.model not in runtimes:
            if req.model == QWEN_ALIAS:
                raise HTTPException(
                    status_code=503,
                    detail="qwen optional fallback is disabled; set ENABLE_QWEN_FALLBACK=1 to enable",
                )
            raise HTTPException(status_code=400, detail=f"unknown model: {req.model}")
        runtime = runtimes[req.model]
        vectors = runtime.encode(as_list(req.texts), req.input_type)
        return {
            "vectors": vectors,
            "model": req.model,
            "provider_model": runtime.model_id,
            "dimension": runtime.dimension,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/embed/query")
def embed_query(req: EmbedRequest, x_api_key: str | None = Header(default=None)):
    check_auth(x_api_key)
    req.model = METRIC_ALIAS
    req.input_type = "query"
    return embed(req, x_api_key)


@app.post("/embed/passage")
def embed_passage(req: EmbedRequest, x_api_key: str | None = Header(default=None)):
    check_auth(x_api_key)
    req.model = METRIC_ALIAS
    req.input_type = "passage"
    return embed(req, x_api_key)
