import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

const migration = await Deno.readTextFile(
  new URL(
    "../../migrations/20260712120006_harden_profile_role_authorization.sql",
    import.meta.url,
  ),
);
const adminCreateUser = await Deno.readTextFile(
  new URL("../admin-create-user/index.ts", import.meta.url),
);

Deno.test("authorization migration closes direct role-write paths", () => {
  assertStringIncludes(
    migration,
    "revoke insert, update, delete on table app.user_profiles from authenticated",
  );
  assertStringIncludes(migration, "revoke update (\n  user_id,");
  assertStringIncludes(migration, "app_role,");
  assertStringIncludes(migration, "drop policy if exists up_update");
  assertStringIncludes(
    migration,
    "drop trigger if exists profiles_compat_update on public.profiles",
  );
  assertEquals(/using\s*\(\s*true\s*\)/i.test(migration), false);
});

Deno.test("authorization RPCs enforce admin or service and write audit records", () => {
  assertStringIncludes(
    migration,
    "app.get_my_role() is distinct from 'admin'::app.app_role",
  );
  assertStringIncludes(migration, "authorization.role_changed");
  assertStringIncludes(migration, "authorization.user_active_changed");
  assertStringIncludes(
    migration,
    "revoke all on function public.admin_set_user_role(uuid, app.app_role) from public, anon",
  );
});

Deno.test("admin-create-user authorizes caller before trusting role or creating user", () => {
  const authorizeAt = adminCreateUser.indexOf("hasUserRole(");
  const validateRoleAt = adminCreateUser.indexOf(
    "requireAssignableAppRole(requestedRole)",
  );
  const createUserAt = adminCreateUser.indexOf("auth.admin.createUser(");
  const assignRoleAt = adminCreateUser.indexOf('rpc("admin_set_user_role"');

  assert(authorizeAt >= 0);
  assert(authorizeAt < validateRoleAt);
  assert(validateRoleAt < createUserAt);
  assert(createUserAt < assignRoleAt);
});
