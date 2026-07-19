import { describe, it } from "jsr:@std/testing@0.225/bdd";
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@0.225";

const MIGRATION_PATH = new URL(
  "../../migrations/20260718230128_hotfix_get_embedding_metrics_service_role_only.sql",
  import.meta.url,
);
const ROLLBACK_PATH = new URL(
  "../../rollback/20260718230128_hotfix_get_embedding_metrics_service_role_only_rollback.sql",
  import.meta.url,
);

async function readSql(url: URL): Promise<string> {
  const bytes = await Deno.readFile(url);
  return new TextDecoder().decode(bytes);
}

function stripSqlComments(sql: string): string {
  return sql.split(/\r?\n/).filter((line) => !/^\s*--/.test(line)).join("\n");
}

function normalizeSql(sql: string): string {
  return stripSqlComments(sql).replace(/\s+/g, " ").toLowerCase();
}

let migration: string;
let rollback: string;

describe("get_embedding_metrics service-role-only contract", () => {
  it("has unique migration timestamp", async () => {
    assert(MIGRATION_PATH.pathname.includes("20260718230128"));
  });

  it("no BOM, conflict markers, credentials", async () => {
    migration = await readSql(MIGRATION_PATH);
    assert(!migration.includes("\uFEFF"), "no BOM");
    assert(!migration.includes("<<<<<<< HEAD"), "no conflict markers");
    assert(!migration.includes("password"), "no credentials");
  });

  it("uses exact function signature and returns table", async () => {
    const code = normalizeSql(migration);
    assert(code.includes("create or replace function public.get_embedding_metrics(p_model text default 'armenian-text-embeddings-2-large'::text)"), "must match signature");
    assert(code.includes("returns table(model text, total_chunks bigint, embedded bigint, pending bigint, failed bigint, est_total_tokens bigint, est_total_cost_usd numeric, est_remaining_cost_usd numeric)"), "must match return table");
  });

  it("is security definer with empty search path", async () => {
    const code = normalizeSql(migration);
    assert(code.includes("security definer"), "must be security definer");
    assert(/set\s+search_path\s+to\s*''/.test(code), "must have empty search_path");
  });

  it("has service-role guard and raises 42501", async () => {
    const code = normalizeSql(migration);
    assert(code.includes("(auth.jwt() ->> 'role') is distinct from 'service_role'"), "must have jwt guard");
    assert(code.includes("raise exception 'service role required' using errcode = '42501'"), "must raise 42501");
  });

  it("app.get_my_role and fail-open admin absent", async () => {
    const code = normalizeSql(migration);
    assertEquals(code.includes("app.get_my_role"), false, "must not use app.get_my_role");
    assertEquals(code.includes("<> 'admin'"), false, "must not use fail-open admin");
  });

  it("grants and revokes correctly", async () => {
    const code = normalizeSql(migration);
    assert(code.includes("revoke all on function public.get_embedding_metrics(text) from public, anon, authenticated, service_role"), "must revoke from all");
    assert(code.includes("grant execute on function public.get_embedding_metrics(text) to service_role"), "must grant to service_role");
    assertEquals(code.includes("to public"), false);
    assertEquals(code.includes("to anon"), false);
    assertEquals(code.includes("to authenticated"), false);
  });

  it("schema qualifies tables", async () => {
    const code = normalizeSql(migration);
    assert(code.includes("public.search_chunks"), "must schema qualify search_chunks");
    assert(code.includes("public.embeddings"), "must schema qualify embeddings");
  });

  it("no dynamic sql", async () => {
    const code = normalizeSql(migration);
    assertEquals(code.includes("execute '"), false);
  });

  it("no INSERT/UPDATE/DELETE/MERGE inside function", async () => {
    const code = normalizeSql(migration);
    assertEquals(/\b(insert|update|delete|merge)\b/.test(code), false, "no data modification");
  });

  it("is wrapped in a transaction", async () => {
    const code = normalizeSql(migration);
    assert(code.startsWith("begin;"), "must start with begin");
    assert(code.trim().endsWith("commit;"), "must end with commit");
  });

  it("rollback retains guard and revokes all", async () => {
    rollback = await readSql(ROLLBACK_PATH);
    const code = normalizeSql(rollback);
    assert(code.includes("(auth.jwt() ->> 'role') is distinct from 'service_role'"), "must retain guard");
    assert(code.includes("revoke all on function public.get_embedding_metrics(text) from public, anon, authenticated, service_role"), "must revoke from all in rollback");
    assertEquals(code.includes("grant execute on function public.get_embedding_metrics(text) to service_role"), false, "must not grant in rollback");
  });

  it("no unrelated function, table, policy, edge, or secret modification", async () => {
    const code = normalizeSql(migration);
    const createFns = code.match(/create or replace function\s+(public|app|internal)\.\w+/g) || [];
    assertEquals(createFns.length, 1, "must touch exactly one function");
    assertEquals(/create policy\b/i.test(code), false, "must not create policies");
    assertEquals(/alter table\b/i.test(code), false, "must not alter tables");
    assertEquals(/drop table\b/i.test(code), false, "must not drop tables");
  });
});
