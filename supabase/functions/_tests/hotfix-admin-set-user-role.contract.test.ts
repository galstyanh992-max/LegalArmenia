// =============================================================================
// HOTFIX contract test: admin_set_user_role service-role-only authorization
// Verifies the migration SQL and containment rollback SQL satisfy the security
// contract. Static contract test: parses the .sql files committed with the
// hotfix and asserts the required structural and authorization properties.
// =============================================================================
import { describe, it } from "jsr:@std/testing@0.225/bdd";
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@0.225";

const MIGRATION_PATH = new URL(
  "../../migrations/20260717141940_hotfix_admin_set_user_role.sql",
  import.meta.url,
);
const ROLLBACK_PATH = new URL(
  "../../rollback/20260717141940_hotfix_admin_set_user_role_rollback.sql",
  import.meta.url,
);

async function readSql(url: URL): Promise<string> {
  const bytes = await Deno.readFile(url);
  return new TextDecoder().decode(bytes);
}

// Strip SQL line comments (-- ...) so contract assertions evaluate the
// executable SQL body, not explanatory comments in the migration header.
function stripSqlComments(sql: string): string {
  return sql.split(/\r?\n/).filter((line) => !/^\s*--/.test(line)).join("\n");
}

describe("hotfix admin_set_user_role contract", () => {
  let migration = "";
  let rollback = "";

  it("migration and rollback files exist and are readable", async () => {
    migration = await readSql(MIGRATION_PATH);
    rollback = await readSql(ROLLBACK_PATH);
    assert(migration.length > 0, "migration file must not be empty");
    assert(rollback.length > 0, "rollback file must not be empty");
  });

  it("preserves exact function signature", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(
      migration,
      "public.admin_set_user_role(\n  p_user_id uuid,\n  p_role app.app_role\n)",
    );
  });

  it("preserves return type void", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration, "returns void");
  });

  it("retains SECURITY DEFINER", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration, "security definer");
  });

  it("sets search_path = ''", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration, "set search_path = ''");
  });

  it("uses IS DISTINCT FROM 'service_role' for JWT role check", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(
      migration,
      "(auth.jwt() ->> 'role') is distinct from 'service_role'",
    );
  });

  it("raises 42501 when caller is not service_role", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration, "raise exception 'Service role required'");
    assertStringIncludes(migration, "using errcode = '42501'");
  });

  it("has no app.get_my_role authorization fallback", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = stripSqlComments(migration);
    assertEquals(
      code.includes("app.get_my_role()"),
      false,
      "authenticated-admin fallback (app.get_my_role) must be removed",
    );
  });

  it("has no NULL-unsafe <> admin guard", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = stripSqlComments(migration);
    assertEquals(
      /is distinct from 'admin'::app\.app_role/.test(code),
      false,
      "NULL-unsafe `<> admin` guard must be removed",
    );
  });

  it("revokes PUBLIC, anon, authenticated, and service_role", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(
      migration,
      "revoke all on function public.admin_set_user_role(uuid, app.app_role)\n  from public, anon, authenticated, service_role",
    );
  });

  it("grants EXECUTE only to service_role", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(
      migration,
      "grant execute on function public.admin_set_user_role(uuid, app.app_role)\n  to service_role",
    );
    assertEquals(
      /grant execute on function public\.admin_set_user_role[^;]*to (authenticated|anon|public)/i
        .test(migration),
      false,
      "must not grant execute to authenticated, anon, or public",
    );
  });

  it("has no broad GRANT ALL", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertEquals(
      /grant all\b/i.test(migration),
      false,
      "no broad GRANT ALL permitted",
    );
  });

  it("uses no dynamic SQL (no EXECUTE of string)", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertEquals(
      /\bexecute\s+'/.test(migration),
      false,
      "no dynamic SQL (EXECUTE of string literal) permitted",
    );
  });

  it("update targets schema-qualified app.user_profiles", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration, "update app.user_profiles");
  });

  it("raises P0002 when target user is not found", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration, "User not found:");
    assertStringIncludes(migration, "using errcode = 'P0002'");
  });

  it("comment records service-role-only authorization model", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(
      migration,
      "Service-role-only role transition. PUBLIC, anon, and authenticated execution removed. NULL-safe fail-closed authorization.",
    );
  });

  // --- rollback contract ---

  it("rollback does NOT restore PUBLIC, anon, or authenticated EXECUTE", async () => {
    rollback = rollback || await readSql(ROLLBACK_PATH);
    assertEquals(
      /grant\s+(execute|all)\s+on\s+function[^;]*(to|from)\s+(public|anon|authenticated)/i
        .test(rollback),
      false,
      "rollback must not grant/restore execute to public, anon, or authenticated",
    );
  });

  it("rollback disables service_role execution (containment)", async () => {
    rollback = rollback || await readSql(ROLLBACK_PATH);
    assertStringIncludes(
      rollback,
      "revoke all on function public.admin_set_user_role(uuid, app.app_role)",
    );
    assertStringIncludes(rollback, "from public, anon, authenticated, service_role");
    assertEquals(
      /grant\s+(execute|all)\s+on\s+function[^;]*to\s+service_role/i.test(rollback),
      false,
      "rollback must NOT re-grant service_role (containment disables RPC)",
    );
  });

  it("rollback marks function disabled and requiring review", async () => {
    rollback = rollback || await readSql(ROLLBACK_PATH);
    assertStringIncludes(
      rollback,
      "DISABLED BY SECURITY CONTAINMENT ROLLBACK. Manual security review required before re-enabling.",
    );
  });

  it("rollback does NOT recreate the vulnerable authenticated-admin body", async () => {
    rollback = rollback || await readSql(ROLLBACK_PATH);
    assertEquals(
      rollback.includes("app.get_my_role()"),
      false,
      "rollback must not restore the vulnerable authenticated-admin fallback body",
    );
  });
});
