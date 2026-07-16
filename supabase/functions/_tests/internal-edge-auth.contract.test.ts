import { assert, assertEquals } from "jsr:@std/assert@1";
import { constantTimeEqual } from "../_shared/edge-security.ts";

Deno.test("internal Edge credential comparison accepts only exact bytes", () => {
  assert(constantTimeEqual("same-secret", "same-secret"));
  assertEquals(constantTimeEqual("same-secret", "same-secreu"), false);
  assertEquals(constantTimeEqual("short", "longer"), false);
  assertEquals(constantTimeEqual("", "secret"), false);
});
