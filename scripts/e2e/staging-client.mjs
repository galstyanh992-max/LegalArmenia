import { createClient } from "@supabase/supabase-js";
import { loadStagingEnv } from "./load-staging-env.mjs";

const c = loadStagingEnv();
export const stagingUrl = c.supabaseUrl;
export const serviceRoleKey = c.serviceRoleKey;
export const anonKey = c.anonKey;

// Per-schema clients. Core auth/case tables live in the `app` schema; comments and
// several KB/CRM tables live in `public`. Auth (signIn) is schema-independent.
const mk = (schema, key) => createClient(c.supabaseUrl, key, { db: { schema }, auth: { persistSession: false } });

export const serviceApp = mk("app", c.serviceRoleKey);
export const servicePublic = mk("public", c.serviceRoleKey);
export const anonApp = mk("app", c.anonKey);
export const anonPublic = mk("public", c.anonKey);

// Build an RLS-enforced client that acts AS a specific user (by access token) for a schema.
export function userClient(schema, accessToken) {
  return createClient(c.supabaseUrl, c.anonKey, {
    db: { schema },
    global: { headers: { Authorization: "Bearer " + accessToken } },
    auth: { persistSession: false },
  });
}
