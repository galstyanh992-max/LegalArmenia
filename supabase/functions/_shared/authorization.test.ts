import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  ASSIGNABLE_APP_ROLES,
  isAssignableAppRole,
  requireAssignableAppRole,
} from "./authorization.ts";

Deno.test("authorization: only live app roles are assignable", () => {
  assertEquals(ASSIGNABLE_APP_ROLES, ["admin", "lawyer", "client"]);
  assertEquals(isAssignableAppRole("admin"), true);
  assertEquals(isAssignableAppRole("lawyer"), true);
  assertEquals(isAssignableAppRole("client"), true);
  assertEquals(isAssignableAppRole("auditor"), false);
  assertEquals(isAssignableAppRole({ role: "admin" }), false);
});

Deno.test("authorization: forged or unsupported request role is rejected", () => {
  assertEquals(requireAssignableAppRole("lawyer"), "lawyer");
  assertThrows(
    () => requireAssignableAppRole("auditor"),
    Error,
    "Unsupported role",
  );
  assertThrows(
    () => requireAssignableAppRole("owner"),
    Error,
    "Unsupported role",
  );
  assertThrows(
    () => requireAssignableAppRole(undefined),
    Error,
    "Unsupported role",
  );
});
