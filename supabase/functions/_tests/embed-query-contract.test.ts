import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const source = await Deno.readTextFile(
  new URL("../embed-query/index.ts", import.meta.url),
);

Deno.test("embed-query enforces Metric model and 1024 finite dimensions", () => {
  assert(
    source.includes('EXPECTED_MODEL = "armenian-text-embeddings-2-large"'),
  );
  assert(source.includes("EXPECTED_DIMENSION = 1024"));
  assert(source.includes("vector.some((value) => !Number.isFinite(value))"));
  assert(source.includes('error: "invalid_embedding"'));
});

Deno.test("embed-query controls oversized input and provider timeout", () => {
  assert(source.includes("MAX_QUERY_CHARS = 8_000"));
  assert(source.includes('error: "query_too_large"'));
  assert(source.includes('error: "embedding_service_timeout"'));
  assert(source.includes("status: 504"));
});

Deno.test("embed-query never returns provider model path", () => {
  assertEquals(source.includes("model: payload.model"), false);
  assert(source.includes("model: EXPECTED_MODEL"));
});
