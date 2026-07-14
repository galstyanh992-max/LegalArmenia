/**
 * RLS smoke test: verifies that anon/auth clients are denied access
 * to server-only tables, while service_role succeeds.
 *
 * Tables tested: audit_logs, error_logs
 * Requires: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Skips gracefully when credentials are not available.
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const canRun = url.length > 0 && anonKey.length > 0 && serviceKey.length > 0;

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

function getAnon() {
  return createClient(url, anonKey, clientOptions);
}
function getService() {
  return createClient(url, serviceKey, clientOptions);
}

// ─── audit_logs: anon SELECT must return empty or error ────────────

Deno.test({
  name: "RLS: anon SELECT on audit_logs returns 0 rows (denied)",
  ignore: !canRun,
  async fn() {
    const { data, error } = await getAnon()
      .from("audit_logs")
      .select("id")
      .limit(1);
    if (error) {
      assertExists(error.message);
    } else {
      assertEquals(data?.length ?? 0, 0, "anon must not see audit_logs rows");
    }
  },
});

// ─── error_logs: anon INSERT must fail ─────────────────────────────

Deno.test({
  name: "RLS: anon INSERT into error_logs is denied",
  ignore: !canRun,
  async fn() {
    const { error } = await getAnon().from("error_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      error_type: "rls_test",
      error_message: "test",
    });
    assertExists(error, "anon INSERT into error_logs must be denied");
  },
});

// ─── audit_logs: anon INSERT must fail ─────────────────────────────

Deno.test({
  name: "RLS: anon INSERT into audit_logs is denied",
  ignore: !canRun,
  async fn() {
    const { error } = await getAnon().from("audit_logs").insert({
      action: "rls_test",
      table_name: "test",
    });
    assertExists(error, "anon INSERT into audit_logs must be denied");
  },
});

// ─── service_role: SELECT on audit_logs succeeds ──────────────────

Deno.test({
  name: "RLS: service_role SELECT on audit_logs succeeds",
  ignore: !canRun,
  async fn() {
    const { error } = await getService()
      .from("audit_logs")
      .select("id")
      .limit(1);
    assertEquals(error, null, "service_role SELECT on audit_logs must succeed");
  },
});

// ─── service_role: INSERT + cleanup on error_logs ──────────────────

Deno.test({
  name: "RLS: service_role INSERT into error_logs succeeds",
  ignore: !canRun,
  async fn() {
    const svc = getService();
    const marker = `rls_smoke_${Date.now()}`;
    const { data, error } = await svc
      .from("error_logs")
      .insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        error_type: marker,
        error_message: "test",
      })
      .select("id")
      .single();
    assertEquals(
      error,
      null,
      "service_role INSERT into error_logs must succeed",
    );
    assertExists(data?.id);
    await svc.from("error_logs").delete().eq("id", data!.id);
  },
});

// ─── service_role: INSERT + cleanup on audit_logs ──────────────────

Deno.test({
  name: "RLS: service_role INSERT into audit_logs succeeds",
  ignore: !canRun,
  async fn() {
    const svc = getService();
    const marker = `rls_smoke_${Date.now()}`;
    const { data, error } = await svc
      .from("audit_logs")
      .insert({
        action: marker,
        table_name: "rls_test",
      })
      .select("id")
      .single();
    assertEquals(
      error,
      null,
      "service_role INSERT into audit_logs must succeed",
    );
    assertExists(data?.id);
    await svc.from("audit_logs").delete().eq("id", data!.id);
  },
});
