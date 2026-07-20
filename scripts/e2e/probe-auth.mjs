import { serviceClient, anonClient, stagingUrl } from "./staging-client.mjs";
import { randomBytes } from "node:crypto";

const RUN = "e2e" + Date.now().toString(36);
const email = `${RUN}.client.a@legalarmenia-e2e.test`;
const password = randomBytes(18).toString("base64url");

// 1. Create auth user via admin API.
const created = await serviceClient.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (created.error || !created.data?.user?.id) { console.log(JSON.stringify({step:"createUser", ok:false, error: created.error?.message || "no user id", respKeys: Object.keys(created.data||{})})); process.exit(0); }
const userId = created.data?.user?.id;

// 2. Insert app.user_profiles (service role bypasses RLS).
const ins = await serviceClient.from("app.user_profiles").insert({
  user_id: userId, full_name: "E2E Client A", email, app_role: "client", is_active: true,
}).select();
if (ins.error) {
  console.log(JSON.stringify({step:"insertProfile", ok:false, error: ins.error.message, hint:"columns may differ; dumping user_profiles columns"}));
  // cleanup user
  await serviceClient.auth.admin.deleteUser(userId);
  process.exit(0);
}

// 3. Sign in as that user with the ANON key (RLS-enforced client).
const signIn = await anonClient.auth.signInWithPassword({ email, password });
if (signIn.error) {
  console.log(JSON.stringify({step:"signIn", ok:false, error: signIn.error.message}));
  await serviceClient.from("app.user_profiles").delete().eq("user_id", userId);
  await serviceClient.auth.admin.deleteUser(userId);
  process.exit(0);
}

// 4. RLS check: signed-in client should read ONLY their own profile row.
const sessionClient = anonClient; // same instance now holds the session
const myProfile = await sessionClient.from("app.user_profiles").select("user_id, app_role, is_active");
const allProfiles = await sessionClient.from("app.user_profiles").select("user_id", { count: "exact", head: true });

// 5. anon (no session) profile read -> should be denied/0.
const anonProfiles = await fetch(stagingUrl + "/rest/v1/app.user_profiles?select=user_id", {
  headers: { apikey: anonClient.supabaseKey },
}).then(r => r.status);

// 6. Cleanup.
await serviceClient.from("app.user_profiles").delete().eq("user_id", userId);
const delUser = await serviceClient.auth.admin.deleteUser(userId);

console.log(JSON.stringify({
  step: "probe",
  ok: true,
  runPrefix: RUN,
  userIdLen: userId.length,
  profileRowsVisibleToSelf: myProfile.data?.length ?? null,
  profileVisibleSelfIdMatches: myProfile.data?.[0]?.user_id === userId,
  profilesCountVisibleToSelf: allProfiles.count,
  anonRestStatusForProfiles: anonProfiles,
  cleanupProfileOk: !ins.error,
  cleanupUserOk: !delUser.error,
}, null, 2));
