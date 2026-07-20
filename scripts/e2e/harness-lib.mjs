// Shared helpers for the E2E harness. No secrets are logged anywhere here.
// NOTE: the `app` schema is NOT exposed via PostgREST on this project; all writes to
// app.user_profiles go through the public.profiles view (INSTEAD OF triggers) or the
// admin_set_user_role / admin_set_user_active RPCs (SECURITY DEFINER).
import { serviceApp, servicePublic, anonApp, anonPublic, userClient, stagingUrl, anonKey } from "./staging-client.mjs";
import { randomBytes } from "node:crypto";

export const RUN_PREFIX = "e2e" + Date.now().toString(36) + ".";
const EMAIL_DOMAIN = "legalarmenia-e2e.test";

// In-memory registry of every auth user we create this run (for guaranteed cleanup).
export const createdUsers = []; // { id, email }
export const fixtures = { users: createdUsers, cases: [], members: [], comments: [], genDocs: [] };

export function newEmail(role) { return RUN_PREFIX + role + "." + randomBytes(3).toString("hex") + "@" + EMAIL_DOMAIN; }
export function newPassword() { return randomBytes(18).toString("base64url") + "A1!"; }

async function setRole(userId, role) {
  const r = await servicePublic.rpc("admin_set_user_role", { p_user_id: userId, p_role: role });
  if (r.error) throw new Error("admin_set_user_role failed: " + r.error.message);
}
async function setActive(userId, active) {
  const r = await servicePublic.rpc("admin_set_user_active", { p_user_id: userId, p_is_active: active });
  if (r.error) throw new Error("admin_set_user_active failed: " + r.error.message);
}
async function deleteProfile(userId) {
  // via public.profiles INSTEAD OF DELETE trigger (service role bypasses RLS)
  const r = await servicePublic.from("profiles").delete().eq("id", userId).select("id");
  return !r.error && (r.data?.length > 0);
}

// Create an auth user + profile with a given role.
// handle_new_user trigger auto-inserts a `client` profile; we then promote/demote via RPCs.
export async function createIdentity(role, { active = true, withProfile = true, fullName = null } = {}) {
  const email = newEmail(role);
  const password = newPassword();
  const cu = await serviceApp.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName || ("E2E " + role) },
  });
  if (cu.error || !cu.data?.user?.id) throw new Error("createUser failed: " + (cu.error?.message || "no id"));
  const userId = cu.data.user.id;
  createdUsers.push({ id: userId, email });

  if (withProfile) {
    // trigger created a client profile; set role (and active state) via sanctioned RPCs.
    if (role !== "client") await setRole(userId, role);
    if (!active) await setActive(userId, false);
  } else {
    // "missing profile" identity: remove the auto-created profile row.
    await deleteProfile(userId);
  }
  return { userId, email, password };
}

export async function signInAs(email, password) {
  const s = await anonApp.auth.signInWithPassword({ email, password });
  if (s.error) return { error: s.error.message, accessToken: null };
  const token = s.data.session.access_token;
  return { accessToken: token, app: userClient("app", token), public: userClient("public", token) };
}

// Delete one auth user: profile first (RESTRICT FK), then auth user.
export async function deleteUser(userId) {
  await deleteProfile(userId);
  // best-effort cleanup of any fixture rows owned by this user
  try { await servicePublic.from("case_comments").delete().eq("author_id", userId); } catch {}
  try { await servicePublic.from("generated_documents").delete().eq("user_id", userId); } catch {}
  try { await servicePublic.from("case_members").delete().eq("user_id", userId); } catch {}
  try { await servicePublic.from("cases").delete().eq("lawyer_id", userId); } catch {}
  const d = await serviceApp.auth.admin.deleteUser(userId);
  return !d.error;
}

// Remove ALL e2e users from prior/failed runs (matched by email domain).
export async function cleanupOrphans() {
  const removed = [];
  let page = 1;
  while (true) {
    const list = await serviceApp.auth.admin.listUsers({ page, perPage: 200 });
    if (list.error || !list.data?.users) break;
    const orphans = list.data.users.filter((u) => (u.email || "").endsWith("@" + EMAIL_DOMAIN));
    for (const u of orphans) {
      await deleteProfile(u.id);
      try { await servicePublic.from("cases").delete().like("title", "E2E %"); } catch {}
      const d = await serviceApp.auth.admin.deleteUser(u.id);
      if (!d.error) removed.push(u.id);
    }
    if (list.data.users.length < 200) break;
    page++;
  }
  return removed.length;
}
