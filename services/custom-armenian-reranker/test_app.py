import math
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app import Settings, create_app


def candidate(candidate_id="a", text="law"):
    return {
        "candidate_id": candidate_id,
        "text": text,
        "trusted_metadata": {"norm_status": "active"},
    }


class ContractTest(unittest.TestCase):
    def setUp(self):
        settings = Settings(
            api_key="x" * 32,
            head_path=Path("unused"),
            head_sha256="head",
            eager_load=False,
        )
        self.client = TestClient(
            create_app(
                settings, lambda _q, rows: [(float(i), 0.5) for i, _ in enumerate(rows)]
            )
        )
        self.headers = {"Authorization": "Bearer " + "x" * 32}

    def test_health_separates_liveness_readiness(self):
        self.assertEqual(
            self.client.get("/health").json(), {"live": True, "ready": True}
        )

    def test_authentication_and_model_info(self):
        self.assertEqual(self.client.get("/model-info").status_code, 401)
        self.assertEqual(
            self.client.get("/model-info", headers=self.headers).json()["head_sha256"],
            "head",
        )

    def test_preserves_candidate_ids(self):
        response = self.client.post(
            "/rerank",
            headers=self.headers,
            json={"query": "q", "candidates": [candidate("a"), candidate("b")]},
        )
        self.assertEqual(
            [row["candidate_id"] for row in response.json()["results"]], ["a", "b"]
        )

    def test_rejects_duplicate_ids_and_extra_metadata(self):
        duplicate = self.client.post(
            "/rerank",
            headers=self.headers,
            json={"query": "q", "candidates": [candidate(), candidate()]},
        )
        self.assertEqual(duplicate.status_code, 422)
        bad = candidate()
        bad["trusted_metadata"]["tenant_id"] = "other"
        self.assertEqual(
            self.client.post(
                "/rerank",
                headers=self.headers,
                json={"query": "q", "candidates": [bad]},
            ).status_code,
            422,
        )

    def test_rejects_nonfinite_scores(self):
        settings = Settings(
            api_key="x" * 32, head_path=Path("unused"), head_sha256="head"
        )
        client = TestClient(create_app(settings, lambda _q, _rows: [(math.nan, 0.5)]))
        self.assertEqual(
            client.post(
                "/rerank",
                headers=self.headers,
                json={"query": "q", "candidates": [candidate()]},
            ).status_code,
            502,
        )


if __name__ == "__main__":
    unittest.main()
