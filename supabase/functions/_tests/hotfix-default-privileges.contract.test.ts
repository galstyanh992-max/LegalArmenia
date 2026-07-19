import { assertEquals, assertMatch, assertNotMatch, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";

const TIMESTAMP = "20260719000001";
const MIGRATION_PATH = `supabase/migrations/${TIMESTAMP}_harden_postgres_default_privileges.sql`;
const ROLLBACK_PATH = `supabase/rollback/${TIMESTAMP}_harden_postgres_default_privileges_rollback.sql`;

Deno.test("PR-F: migration and rollback locations correct", async () => {
  const statMig = await Deno.stat(MIGRATION_PATH);
  assert(statMig.isFile);
  const statRoll = await Deno.stat(ROLLBACK_PATH);
  assert(statRoll.isFile);
});

Deno.test("PR-F: migration format and content assertions", async () => {
  const content = await Deno.readTextFile(MIGRATION_PATH);

  // LF ending
  assert(!content.includes("\r\n"), "Must use LF endings");

  // BEGIN/COMMIT present
  assertMatch(content, /^BEGIN;/m);
  assertMatch(content, /^COMMIT;/m);

  // every ALTER DEFAULT PRIVILEGES includes FOR ROLE postgres
  const alterDefaults = content.match(/ALTER DEFAULT PRIVILEGES/g) || [];
  const forRolePostgres = content.match(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres/g) || [];
  assertEquals(alterDefaults.length, forRolePostgres.length, "All ALTER DEFAULT PRIVILEGES must specify FOR ROLE postgres");

  // global PUBLIC function revoke exists
  assertMatch(content, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres\s+REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;/i);

  // public anon/authenticated function revoke exists
  assertMatch(content, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;/i);

  // public anon/authenticated table revoke exists
  assertMatch(content, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL(?: PRIVILEGES)? ON TABLES FROM anon, authenticated;/i);

  // public anon/authenticated sequence revoke exists
  assertMatch(content, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL(?: PRIVILEGES)? ON SEQUENCES FROM anon, authenticated;/i);

  // no GRANT to PUBLIC
  assertNotMatch(content, /GRANT\s+.*?TO\s+PUBLIC/i);

  // no GRANT to anon
  assertNotMatch(content, /GRANT\s+.*?TO\s+(?:.*?,)?\s*anon/i);

  // no GRANT to authenticated
  assertNotMatch(content, /GRANT\s+.*?TO\s+(?:.*?,)?\s*authenticated/i);

  // no modification of existing object ACLs
  assertNotMatch(content, /^GRANT/mi, "No standalone GRANT except for defaults");
  assertNotMatch(content, /^REVOKE/mi, "No standalone REVOKE except for defaults");

  // no CREATE OR REPLACE FUNCTION
  assertNotMatch(content, /CREATE OR REPLACE FUNCTION/i);

  // no ALTER TABLE
  assertNotMatch(content, /ALTER TABLE/i);

  // no RLS/policy statements
  assertNotMatch(content, /CREATE POLICY/i);
  assertNotMatch(content, /ALTER POLICY/i);
  assertNotMatch(content, /ENABLE ROW LEVEL SECURITY/i);

  // no managed Supabase role modification
  assertNotMatch(content, /supabase_admin/i);
  assertNotMatch(content, /supabase_auth_admin/i);

  // no project refs or secrets
  assertNotMatch(content, /avmgtsonawtzebvazgcr/i);
  assertNotMatch(content, /vavjajwiqsdhlweggalw/i);
  assertNotMatch(content, /password/i);
  assertNotMatch(content, /token/i);
});

Deno.test("PR-F: rollback semantics", async () => {
  const rollbackContent = await Deno.readTextFile(ROLLBACK_PATH);
  assertMatch(rollbackContent, /FAIL_CLOSED_FUTURE_OBJECT_CONTAINMENT/i);
  assertMatch(rollbackContent, /REVOKE EXECUTE ON FUNCTIONS FROM service_role/i);
  assertMatch(rollbackContent, /REVOKE ALL(?: PRIVILEGES)? ON TABLES FROM service_role/i);
  assertMatch(rollbackContent, /REVOKE ALL(?: PRIVILEGES)? ON SEQUENCES FROM service_role/i);
});
