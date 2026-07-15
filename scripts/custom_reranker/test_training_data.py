import unittest

from build_engineering_training_set import normalized, sha_rows


class TrainingDataTest(unittest.TestCase):
    def test_normalization_preserves_armenian(self):
        self.assertEqual(normalized("Օրենք՝ հոդված 1։"), "օրենք հոդված 1")

    def test_canonical_hash_is_key_order_independent(self):
        self.assertEqual(sha_rows([{"b": 2, "a": 1}]), sha_rows([{"a": 1, "b": 2}]))


if __name__ == "__main__":
    unittest.main()
