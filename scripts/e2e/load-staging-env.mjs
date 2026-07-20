// Staging credential loader for the interactive E2E acceptance loop.
// Safety: secrets are NEVER read from chat and NEVER logged. They come only from
// (1) an approved local secret store file, or (2) the protected process environment.
//
// Approved secret store location (gitignored, outside the worktree):
//   D:\1V\_secrets\legalarmenia-staging.env
//
// Resolution order: process env (already set) -> approved secret store file.
// Throws on missing required values so callers fail closed before touching staging.

import { readFileSync, existsSync } from "node:fs";

const SECRET_STORE_PATH = String(process.env.LEGALARMENIA_STAGING_ENV || "D:\\1V\\_secrets\\legalarmenia-staging.env");

const REQUIRED = [
  "STAGING_SUPABASE_URL",
  "STAGING_SUPABASE_ANON_KEY",
  "STAGING_SUPABASE_SERVICE_ROLE_KEY",
];

function parseDotenv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadSecretStore() {
  if (!existsSync(SECRET_STORE_PATH)) return {};
  try {
    return parseDotenv(readFileSync(SECRET_STORE_PATH, "utf8"));
  } catch (err) {
    throw new Error(`Failed to read approved secret store ${SECRET_STORE_PATH}: ${err.message}`);
  }
}

export function loadStagingEnv() {
  const file = loadSecretStore();
  const env = {};
  for (const key of [...REQUIRED, "STAGING_DATABASE_URL", "STAGING_PROJECT_REF", "OPENROUTER_API_KEY"]) {
    env[key] = process.env[key] || file[key] || "";
  }
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `Staging credentials incomplete. Missing: ${missing.join(", ")}. ` +
        `Place them in approved secret store (${SECRET_STORE_PATH}) or export them in the protected ` +
        `process environment. Never paste secrets into chat.`,
    );
  }
  const url = String(env.STAGING_SUPABASE_URL);
  const ref = String(env.STAGING_PROJECT_REF || "");
  if (ref && !url.includes(ref) && !url.includes("vavjajwiqsdhlweggalw")) {
    throw new Error(`Staging URL does not match expected staging project ref. Aborting to protect production.`);
  }
  return {
    supabaseUrl: env.STAGING_SUPABASE_URL,
    anonKey: env.STAGING_SUPABASE_ANON_KEY,
    serviceRoleKey: env.STAGING_SUPABASE_SERVICE_ROLE_KEY,
    databaseUrl: env.STAGING_DATABASE_URL || "",
    projectRef: ref,
  };
}

// CLI self-check: prints only presence/absence, never values.
if (process.argv[1] && process.argv[1].endsWith("load-staging-env.mjs")) {
  try {
    const c = loadStagingEnv();
    console.log(JSON.stringify({
      ok: true,
      urlPresent: !!c.supabaseUrl,
      anonPresent: !!c.anonKey,
      serviceRolePresent: !!c.serviceRoleKey,
      databaseUrlPresent: !!c.databaseUrl,
      projectRef: c.projectRef || "(derived from URL)",
    }));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: err.message }));
    process.exit(2);
  }
}
