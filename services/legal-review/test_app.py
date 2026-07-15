import json
import tempfile
import unittest
from pathlib import Path

from app import ReviewStore


class ReviewStoreTest(unittest.TestCase):
    def test_independent_label_contract_and_duplicate_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch = root / "batch.jsonl"
            batch.write_text(
                json.dumps(
                    {
                        "review_item_id": "x",
                        "query_id": "q",
                        "candidate_id": "c",
                        "intent": "semantic",
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            store = ReviewStore(batch, root / "labels.jsonl", "reviewer-a")
            payload = {
                "review_item_id": "x",
                "legal_relevance": 3,
                "answers_query": True,
                "provision_specificity": 3,
                "authority_correct": True,
                "status_correct": True,
                "temporally_valid": True,
                "citation_document_correct": True,
                "citation_provision_correct": True,
                "answerable": True,
                "reason_codes": [],
            }
            record = store.submit(payload)
            self.assertEqual(record["reviewer_id"], "reviewer-a")
            with self.assertRaisesRegex(ValueError, "already reviewed"):
                store.submit(payload)

    def test_rejects_unknown_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch = root / "batch.jsonl"
            batch.write_text(
                json.dumps(
                    {"review_item_id": "x", "query_id": "q", "candidate_id": "c"}
                )
                + "\n",
                encoding="utf-8",
            )
            store = ReviewStore(batch, root / "labels.jsonl", "a")
            with self.assertRaisesRegex(ValueError, "invalid fields"):
                store.submit({"review_item_id": "x", "system_rank": 1})


if __name__ == "__main__":
    unittest.main()
