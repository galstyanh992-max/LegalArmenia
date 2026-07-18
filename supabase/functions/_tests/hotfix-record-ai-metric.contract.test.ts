// =============================================================================
// HOTFIX contract test: record_ai_metric service-role-only containment
// Verifies the forward migration SQL and the containment rollback SQL satisfy
// the security contract. Static contract test: parses the .sql files committed
// with the hotfix and asserts the required structural and authorization
// properties. No database access.
// =============================================================================
import { describe, it } from "jsr:@std/testing@0.225/bdd";
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@0.225";

const MIGRATION_PATH = new URL(
  "../../migrations/20260718180110_hotfix_record_ai_metric_service_role_only.sql",
  import.meta.url,
);
const ROLLBACK_PATH = new URL(
  "../../rollback/20260718180110_hotfix_record_ai_metric_service_role_only_rollback.sql",
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

// Collapse all whitespace runs to a single space so authorization-pattern
// regexes match regardless of line breaks / indentation.
function normalizeSql(sql: string): string {
  return stripSqlComments(sql).replace(/\s+/g, " ").trim().toLowerCase();
}

describe("hotfix record_ai_metric contract", () => {
  let migration = "";
  let rollback = "";

  it("migration and rollback files exist and are readable", async () => {
    migration = await readSql(MIGRATION_PATH);
    rollback = await readSql(ROLLBACK_PATH);
    assert(migration.length > 0, "migration file must not be empty");
    assert(rollback.length > 0, "rollback file must not be empty");
  });

  // 1. exact forward migration timestamp is unique
  it("uses the unique forward migration timestamp 20260718180110", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration, "20260718180110");
    // The rollback must NOT share any other migration timestamp and must not
    // reference the prior hotfix timestamp.
    assertEquals(
      migration.includes("20260717141940"),
      false,
      "must not reuse the prior hotfix timestamp",
    );
  });

  // 2. no UTF-8 BOM
  it("migration and rollback have no UTF-8 BOM", async () => {
    const mBytes = await Deno.readFile(MIGRATION_PATH);
    const rBytes = await Deno.readFile(ROLLBACK_PATH);
    assertEquals(mBytes[0] !== 0xef && mBytes[1] !== 0xbb && mBytes[2] !== 0xbf, true,
      "migration must not start with a UTF-8 BOM");
    assertEquals(rBytes[0] !== 0xef && rBytes[1] !== 0xbb && rBytes[2] !== 0xbf, true,
      "rollback must not start with a UTF-8 BOM");
  });

  // 3. no conflict markers
  it("contains no git conflict markers", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    rollback = rollback || await readSql(ROLLBACK_PATH);
    for (const text of [migration, rollback]) {
      const stripped = stripSqlComments(text);
      assertEquals(/^<<<<<<<\s/m.test(stripped), false, "<<<<<<< conflict marker found");
      assertEquals(/^>>>>>>>\s/m.test(stripped), false, ">>>>>>> conflict marker found");
      assertEquals(/^={7}$/m.test(stripped), false, "======= conflict marker found");
    }
  });

  // 4. no secrets
  it("contains no secrets or credentials", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    rollback = rollback || await readSql(ROLLBACK_PATH);
    for (const text of [migration, rollback]) {
      assertEquals(/supabase_service_role_key\s*[:=]/i.test(text), false,
        "must not embed a service role key literal");
      assertEquals(/\bsk-[a-z0-9]{16,}/i.test(text), false, "must not embed an sk- key");
      assertEquals(/postgres:\/\/[^:\s]+:[^@\s]+@/i.test(text), false,
        "must not embed a DB connection password");
      assertEquals(/\beyJ[a-zA-Z0-9_-]{10,}\b/.test(text), false,
        "must not embed a JWT literal");
    }
  });

  // 5. exact function signature retained (all 10 params, names, defaults, order)
  it("preserves the exact public function signature", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assert(
      code.includes(
        "public.record_ai_metric( p_fn_name text, p_model text default null::text, p_input_tokens integer default 0, p_output_tokens integer default 0, p_cost_usd numeric default 0, p_latency_ms integer default null::integer, p_status text default 'success'::text, p_error_message text default null::text, p_case_id uuid default null::uuid, p_user_id uuid default null::uuid )",
      ),
      "public signature (names, defaults, order) must be preserved exactly",
    );
  });

  it("preserves return type void", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration.toLowerCase(), "returns void");
  });

  // 6. SECURITY DEFINER retained only as designed
  it("retains SECURITY DEFINER", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration.toLowerCase(), "security definer");
  });

  // 7. search_path is exactly empty
  it("sets search_path = '' (empty)", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration.toLowerCase(), "set search_path = ''");
    // must NOT keep the old mutable search_path
    assertEquals(
      /set search_path\s*(to|=)\s*['"]?internal['"]?/i.test(migration),
      false,
      "must not retain the old internal/public/auth/pg_temp search_path",
    );
  });

  // 8. positive presence of IS DISTINCT FROM 'service_role'
  it("positively requires IS DISTINCT FROM 'service_role' JWT check", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assert(
      /\(auth\.jwt\(\)\s*->>\s*'role'\)\s+is\s+distinct\s+from\s+'service_role'/.test(code),
      "function body must use (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'",
    );
  });

  it("raises 42501 when caller is not service_role", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration, "raise exception 'Service role required'");
    assertStringIncludes(migration, "using errcode = '42501'");
  });

  // 9. rejection of app.get_my_role() <> 'admin'
  it("rejects NULL-unsafe app.get_my_role() <> 'admin' guard", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assertEquals(
      /app\.get_my_role\(\)\s*(<>|!=)\s*'admin'/i.test(code),
      false,
      "NULL-unsafe app.get_my_role() <> 'admin' guard must be absent",
    );
  });

  // 10. rejection of (auth.jwt() ->> 'role') <> 'service_role'
  it("rejects NULL-unsafe (auth.jwt() ->> 'role') <> 'service_role'", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assertEquals(
      /\(auth\.jwt\(\)\s*->>\s*'role'\)\s*(<>|!=)\s*'service_role'/i.test(code),
      false,
      "NULL-unsafe (auth.jwt() ->> 'role') <> 'service_role' must be absent",
    );
  });

  // 11. rejection of auth.jwt() ->> 'role' != 'service_role'
  it("rejects NULL-unsafe auth.jwt() ->> 'role' != 'service_role'", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assertEquals(
      /auth\.jwt\(\)\s*->>\s*'role'\s*!=\s*'service_role'/i.test(code),
      false,
      "NULL-unsafe auth.jwt() ->> 'role' != 'service_role' must be absent",
    );
  });

  // 12. no authenticated-admin fallback
  it("has no app.get_my_role authorization fallback", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assertEquals(
      code.includes("app.get_my_role()"),
      false,
      "authenticated-admin fallback (app.get_my_role) must be absent",
    );
  });

  // 13. no PUBLIC/anon/authenticated EXECUTE
  it("revokes PUBLIC, anon, authenticated, and service_role before granting", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assert(
      /revoke all on function public\.record_ai_metric\([^)]*\)\s+from public, anon, authenticated, service_role/
        .test(code),
      "must REVOKE ALL FROM public, anon, authenticated, service_role",
    );
  });

  it("does not GRANT EXECUTE to PUBLIC, anon, or authenticated", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertEquals(
      /grant\s+(execute|all)\s+on\s+function\s+public\.record_ai_metric[^;]*\bto\b\s+(public|anon|authenticated)/i
        .test(migration),
      false,
      "must not grant execute to public, anon, or authenticated",
    );
  });

  // 14. service_role EXECUTE present
  it("grants EXECUTE only to service_role", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assert(
      /grant execute on function public\.record_ai_metric\([^)]*\)\s+to service_role/.test(code),
      "must GRANT EXECUTE TO service_role",
    );
  });

  it("has no broad GRANT ALL", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertEquals(/grant all\b/i.test(migration), false, "no broad GRANT ALL permitted");
  });

  // 15. target insert remains schema-qualified
  it("inserts into schema-qualified internal.ai_metrics", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assert(code.includes("insert into internal.ai_metrics"),
      "insert target must be schema-qualified internal.ai_metrics");
    // must not use an unqualified `ai_metrics` target
    assertEquals(
      /insert\s+into\s+ai_metrics\b(?!_)/i.test(code),
      false,
      "must not insert into unqualified ai_metrics",
    );
  });

  // 16. no dynamic SQL
  it("uses no dynamic SQL (no EXECUTE of string)", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertEquals(
      /\bexecute\s+'/.test(migration),
      false,
      "no dynamic SQL (EXECUTE of string literal) permitted",
    );
    assertEquals(
      /\bexecute\s+v_/i.test(migration),
      false,
      "no dynamic SQL (EXECUTE of string variable) permitted",
    );
  });

  // 17. forward migration is transactional
  it("wraps the forward migration in one explicit transaction", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assert(/^begin\b/.test(code), "forward migration must BEGIN; first");
    assert(/commit;\s*$/.test(code), "forward migration must COMMIT; last");
  });

  // 18. rollback never restores vulnerable ACL
  it("rollback does NOT restore PUBLIC, anon, or authenticated EXECUTE", async () => {
    rollback = rollback || await readSql(ROLLBACK_PATH);
    assertEquals(
      /grant\s+(execute|all)\s+on\s+function[^;]*(to|from)\s+(public|anon|authenticated)/i
        .test(rollback),
      false,
      "rollback must not grant/restore execute to public, anon, or authenticated",
    );
  });

  // 19. rollback removes service_role EXECUTE (containment)
  it("rollback revokes service_role EXECUTE (containment disables RPC)", async () => {
    rollback = rollback || await readSql(ROLLBACK_PATH);
    const code = normalizeSql(rollback);
    assert(
      /revoke all on function public\.record_ai_metric\([^)]*\)\s+from public, anon, authenticated, service_role/
        .test(code),
      "rollback must REVOKE ALL FROM public, anon, authenticated, service_role",
    );
    assertEquals(
      /grant\s+(execute|all)\s+on\s+function[^;]*to\s+service_role/i.test(rollback),
      false,
      "rollback must NOT re-grant service_role (containment disables RPC)",
    );
  });

  // 20. rollback leaves safe body in place
  it("rollback leaves the safe fail-closed service_role guard body in place", async () => {
    rollback = rollback || await readSql(ROLLBACK_PATH);
    const code = normalizeSql(rollback);
    assert(
      /\(auth\.jwt\(\)\s*->>\s*'role'\)\s+is\s+distinct\s+from\s+'service_role'/.test(code),
      "rollback must retain the fail-closed JWT guard body",
    );
    assert(code.includes("insert into internal.ai_metrics"),
      "rollback body must still contain the schema-qualified insert");
  });

  it("rollback does NOT recreate the vulnerable body (no auth-bypass insert)", async () => {
    rollback = rollback || await readSql(ROLLBACK_PATH);
    const code = normalizeSql(rollback);
    assertEquals(
      code.includes("app.get_my_role()"),
      false,
      "rollback must not restore an authenticated-admin fallback body",
    );
    // The rollback body must still raise 42501 for non-service callers.
    assertStringIncludes(rollback, "raise exception 'Service role required'");
  });

  it("rollback comment marks the RPC disabled pending reviewed recovery", async () => {
    rollback = rollback || await readSql(ROLLBACK_PATH);
    assertStringIncludes(rollback, "DISABLED pending reviewed recovery");
  });

  // 21. no unrelated function is modified
  it("does not modify any unrelated function", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    // The only CREATE OR REPLACE FUNCTION target must be record_ai_metric.
    const createFns = code.match(/create or replace function\s+(public|app|internal)\.\w+/g) || [];
    assertEquals(createFns.length, 1, "must touch exactly one function");
    assertEquals(createFns[0], "create or replace function public.record_ai_metric");
    // Must not alter the other audited SD functions.
    for (const other of [
      "public.get_embedding_metrics",
      "public.get_ai_metrics_summary",
      "public.admin_set_user_role",
      "public.admin_set_user_active",
      "public.handle_new_user",
      "public.cases_compat_insert",
      "public.search_legal_corpus",
      "public.search_legal_corpus_dual",
      "public.search_legal_unit_chunks_preview",
      "app.get_my_role",
      "app.can_manage_case",
      "app.can_read_case",
    ]) {
      const needle = other.toLowerCase();
      // Allow only the comment text (which references service_role callers generally);
      // the executable SQL must not CREATE/ALTER/REVOKE/GRANT any other function.
      assertEquals(
        new RegExp(`(create or replace function|alter function|revoke all on function|grant execute on function)\\s+${needle.replace(/\./g, "\\.")}`).test(code),
        false,
        `must not modify unrelated function ${other}`,
      );
    }
  });

  // 22. no unrelated table or policy is modified
  it("does not modify any unrelated table or policy", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    const code = normalizeSql(migration);
    assertEquals(/create policy\b/i.test(code), false, "must not create policies");
    assertEquals(/drop policy\b/i.test(code), false, "must not drop policies");
    assertEquals(/alter table\b/i.test(code), false, "must not alter tables");
    assertEquals(/drop table\b/i.test(code), false, "must not drop tables");
    assertEquals(/create table\b/i.test(code), false, "must not create tables");
    // The only relation touched by DML must be internal.ai_metrics (the insert).
    assertEquals(
      /\b(update|delete from|truncate)\s+(?!internal\.ai_metrics)/i.test(code),
      false,
      "must not UPDATE/DELETE/TRUNCATE any table other than none (insert-only)",
    );
  });

  it("function comment records service-role-only authorization model", async () => {
    migration = migration || await readSql(MIGRATION_PATH);
    assertStringIncludes(migration, "service-role-only: direct browser/anon/authenticated invocation is prohibited");
  });
});