import { assertEquals, assertMatch } from "https://deno.land/std@0.192.0/testing/asserts.ts";

const MIGRATION_FILE = "supabase/migrations/20260719000000_hotfix_trigger_function_execute_grants.sql";
const ROLLBACK_FILE = "supabase/rollback/20260719000000_hotfix_trigger_function_execute_grants_rollback.sql";

Deno.test("Migration timestamp is unique and later than baseline", () => {
  const match = MIGRATION_FILE.match(/(\d{14})/);
  if (!match) throw new Error("No timestamp found in filename");
  const timestamp = parseInt(match[1], 10);
  assertEquals(timestamp > 20260718230128, true);
});

Deno.test("Exactly one migration file under supabase/migrations starts with 20260719000000 and no rollback inside", async () => {
  let matchCount = 0;
  for await (const dirEntry of Deno.readDir("supabase/migrations")) {
    if (dirEntry.name.startsWith("20260719000000")) {
      matchCount++;
      assertEquals(dirEntry.name.includes("rollback"), false, "Rollback file should not be in migrations folder");
    }
  }
  assertEquals(matchCount, 1);
});

Deno.test("Forward migration starts with BEGIN, ends with COMMIT, and ends with LF", () => {
  const fileBytes = Deno.readFileSync(MIGRATION_FILE);
  const sql = new TextDecoder().decode(fileBytes);
  assertEquals(fileBytes[fileBytes.length - 1], 10, "File must end with LF (10)");
  assertEquals(sql.trim().startsWith("BEGIN;"), true);
  assertEquals(sql.trim().endsWith("COMMIT;"), true);
});

Deno.test("Rollback migration starts with BEGIN, ends with COMMIT, and ends with LF", () => {
  const fileBytes = Deno.readFileSync(ROLLBACK_FILE);
  const sql = new TextDecoder().decode(fileBytes);
  assertEquals(fileBytes[fileBytes.length - 1], 10, "File must end with LF (10)");
  assertEquals(sql.trim().startsWith("BEGIN;"), true);
  assertEquals(sql.trim().endsWith("COMMIT;"), true);
});

Deno.test("Forward migration revokes EXACTLY PUBLIC, anon, authenticated from EXACTLY two target functions", () => {
  const sql = Deno.readTextFileSync(MIGRATION_FILE);
  
  // Contains only exactly two target functions
  const fnMatch = sql.match(/public\.[a-zA-Z0-9_]+\(\)/gi);
  const uniqueFns = [...new Set(fnMatch)];
  assertEquals(uniqueFns.length, 2);
  assertEquals(uniqueFns.some(f => /cases_compat_insert/i.test(f)), true);
  assertEquals(uniqueFns.some(f => /handle_new_user/i.test(f)), true);
  
  // Exactly two REVOKE statements
  const revokeRegex = /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.(cases_compat_insert|handle_new_user)\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/gi;
  const revokes = sql.match(revokeRegex);
  assertEquals(revokes?.length, 2);
  
  // Does NOT revoke service_role
  assertEquals(/service_role/i.test(sql), false);
});

Deno.test("Rollback restores exactly the two target grants", () => {
  const sql = Deno.readTextFileSync(ROLLBACK_FILE);
  const grantRegex = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.(cases_compat_insert|handle_new_user)\(\)\s+TO\s+PUBLIC,\s*anon,\s*authenticated/gi;
  const grants = sql.match(grantRegex);
  assertEquals(grants?.length, 2);
});

Deno.test("Forward migration does NOT contain any DDL outside of REVOKE", () => {
  const sql = Deno.readTextFileSync(MIGRATION_FILE).toUpperCase();
  assertEquals(sql.includes("CREATE OR REPLACE"), false);
  assertEquals(sql.includes("CREATE FUNCTION"), false);
  assertEquals(sql.includes("DROP FUNCTION"), false);
  assertEquals(sql.includes("CREATE TRIGGER"), false);
  assertEquals(sql.includes("DROP TRIGGER"), false);
  assertEquals(sql.includes("ALTER TABLE"), false);
  assertEquals(sql.includes("ALTER VIEW"), false);
  assertEquals(sql.includes("CREATE VIEW"), false);
  assertEquals(sql.includes("CREATE POLICY"), false);
  assertEquals(sql.includes("DROP POLICY"), false);
  assertEquals(sql.includes("INSERT INTO"), false);
  assertEquals(sql.includes("UPDATE "), false);
  assertEquals(sql.includes("DELETE FROM"), false);
  assertEquals(sql.includes("MERGE "), false);
  
  // Check for search_path, owner, security definer changes, or function body
  assertEquals(sql.includes("SEARCH_PATH"), false);
  assertEquals(sql.includes("OWNER TO"), false);
  assertEquals(sql.includes("SECURITY DEFINER"), false);
  assertEquals(sql.includes("LANGUAGE PLPGSQL"), false);
});

Deno.test("Migrations do NOT contain secrets or remote project references", () => {
  const sqls = [Deno.readTextFileSync(MIGRATION_FILE), Deno.readTextFileSync(ROLLBACK_FILE)];
  for (const sql of sqls) {
    assertEquals(/eyJ/i.test(sql), false);
    assertEquals(/password/i.test(sql), false);
    assertEquals(/avmgtsonawtzebvazgcr/i.test(sql), false);
    assertEquals(/vavjajwiqsdhlweggalw/i.test(sql), false);
  }
});
