import { serviceApp, servicePublic } from "./staging-client.mjs";
const lu = await serviceApp.auth.admin.listUsers({ page: 1, perPage: 100 });
console.log(JSON.stringify({ listOk: !lu.error, err: lu.error?.message || null, totalUsers: lu.data?.users?.length ?? null, auditedCount: lu.data?.aud ?? null, sampleEmails: (lu.data?.users||[]).slice(0,5).map(u=>u.email) }));
// profiles baseline
const p = await servicePublic.from("profiles").select("id", { count: "exact", head: true });
console.log(JSON.stringify({ profilesCount: p.count, profilesErr: p.error?.message || null }));
const up = await serviceApp.from("user_profiles").select("user_id, app_role, is_active, email", { count: "exact" });
console.log(JSON.stringify({ userProfileCount: up.count, rows: (up.data||[]).map(r=>({ role: r.app_role, active: r.is_active, emailDomain: (r.email||"").split("@").pop() })) }));
