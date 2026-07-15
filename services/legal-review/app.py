#!/usr/bin/env python3
"""Local-only blind legal review server. One process serves exactly one reviewer slot."""

from __future__ import annotations

import argparse
import hmac
import json
from datetime import UTC, datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from typing import Any

REQUIRED = {
    "legal_relevance",
    "answers_query",
    "provision_specificity",
    "authority_correct",
    "status_correct",
    "temporally_valid",
    "citation_document_correct",
    "citation_provision_correct",
    "answerable",
    "reason_codes",
}


class ReviewStore:
    def __init__(self, batch: Path, labels: Path, reviewer_id: str) -> None:
        self.items = [
            json.loads(line)
            for line in batch.read_text(encoding="utf-8").splitlines()
            if line
        ]
        self.by_id = {item["review_item_id"]: item for item in self.items}
        self.labels_path = labels
        self.reviewer_id = reviewer_id
        self.lock = Lock()
        labels.parent.mkdir(parents=True, exist_ok=True)

    def labels(self) -> dict[str, dict[str, Any]]:
        if not self.labels_path.exists():
            return {}
        rows = [
            json.loads(line)
            for line in self.labels_path.read_text(encoding="utf-8").splitlines()
            if line
        ]
        return {row["review_item_id"]: row for row in rows}

    def next_item(self) -> dict[str, Any] | None:
        done = self.labels()
        return next(
            (item for item in self.items if item["review_item_id"] not in done), None
        )

    def submit(self, payload: dict[str, Any]) -> dict[str, Any]:
        unknown = set(payload) - (REQUIRED | {"review_item_id"})
        missing = REQUIRED - set(payload)
        if unknown or missing:
            raise ValueError(
                f"invalid fields; missing={sorted(missing)} unknown={sorted(unknown)}"
            )
        item = self.by_id.get(str(payload.get("review_item_id")))
        if not item:
            raise ValueError("unknown review_item_id")
        relevance = payload["legal_relevance"]
        specificity = payload["provision_specificity"]
        if not isinstance(relevance, int) or relevance not in range(4):
            raise ValueError("legal_relevance must be integer 0..3")
        if not isinstance(specificity, int) or specificity not in range(4):
            raise ValueError("provision_specificity must be integer 0..3")
        bool_fields = REQUIRED - {
            "legal_relevance",
            "provision_specificity",
            "reason_codes",
        }
        if any(not isinstance(payload[field], bool) for field in bool_fields):
            raise ValueError("boolean label fields must be boolean")
        if not isinstance(payload["reason_codes"], list) or any(
            not isinstance(x, str) for x in payload["reason_codes"]
        ):
            raise ValueError("reason_codes must be string array")
        record = {
            "review_item_id": item["review_item_id"],
            "query_id": item["query_id"],
            "candidate_id": item["candidate_id"],
            "intent": item.get("intent"),
            **{field: payload[field] for field in sorted(REQUIRED)},
            "reviewer_id": self.reviewer_id,
            "review_timestamp": datetime.now(UTC).isoformat(),
        }
        with self.lock:
            labels = self.labels()
            if record["review_item_id"] in labels:
                raise ValueError("item already reviewed")
            with self.labels_path.open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(record, ensure_ascii=False) + "\n")
        return record


def handler_factory(store: ReviewStore, token: str, ui: Path):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            return

        def authorized(self) -> bool:
            supplied = self.headers.get("Authorization", "").removeprefix("Bearer ")
            return bool(token) and hmac.compare_digest(supplied, token)

        def send_json(self, status: int, payload: Any) -> None:
            data = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:
            if self.path == "/":
                data = ui.read_bytes()
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            if not self.authorized():
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                return
            if self.path == "/api/next":
                self.send_json(
                    HTTPStatus.OK,
                    {
                        "item": store.next_item(),
                        "completed": len(store.labels()),
                        "total": len(store.items),
                    },
                )
                return
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})

        def do_POST(self) -> None:
            if not self.authorized():
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                return
            if self.path != "/api/submit":
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 65536:
                    raise ValueError("invalid body size")
                payload = json.loads(self.rfile.read(length))
                self.send_json(HTTPStatus.CREATED, store.submit(payload))
            except (ValueError, json.JSONDecodeError) as error:
                self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": str(error)})

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=Path, required=True)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--reviewer-id", required=True)
    parser.add_argument("--token", required=True)
    parser.add_argument("--port", type=int, default=8093)
    args = parser.parse_args()
    if len(args.token) < 24:
        raise SystemExit("token must be at least 24 characters")
    store = ReviewStore(args.batch, args.labels, args.reviewer_id)
    ui = Path(__file__).with_name("review.html")
    server = ThreadingHTTPServer(
        ("127.0.0.1", args.port), handler_factory(store, args.token, ui)
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
