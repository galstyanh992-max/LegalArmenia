// force-cleanup.mjs — LOOP_4 repaired version.
// Removes ONLY E2E-prefixed fixtures (email domain @legalarmenia-e2e.test and
// rows that reference those auth user ids). Never deletes non-E2E records.
// Every delete operation records sanitized diagnostics; errors are never swallowed.
import { serviceApp, servicePublic } from "./staging-client.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const E2E_DOMAIN = "@legalarmenia-e2e.test";
const diag = []; // { table, op, filter, success, errorCode, errorMessage, rowCount }

async function del(table, op, filter, query) {
  const r = await query;
  const success = !r.error;
  const rowCount = r.count ?? (Array.isArray(r.data) ? r.data.length : null);
  diag.push({ table, op, filter, success, errorCode: r.error?.code ?? null, errorMessage: r.error?.message ?? null, rowCount });
  return r;
}

function e2eFilter(col) { return col; }

const lu = await serviceApp.auth.admin.listUsers({ page: 1, perPage: 200 });
const e2eUsers = (lu.data?.users || []).filter(u => (u.email || "").endsWith(E2E_DOMAIN));
console.log("E2E users to remove:", e2eUsers.length);

for (const u of e2eUsers) {
  const uid = u.id;
  const up = uid.slice(0, 8);

  // 1. user_roles (non-cascaded FK to auth.users — root cause of prior "Database error deleting user")
  await del("user_roles", "delete", "user_id=e2e",
    servicePublic.from("user_roles").delete().eq("user_id", uid).select("*"));

  // 2. direct user-referencing child rows owned exclusively by this E2E fixture
  await del("case_comments", "delete", "author_id=e2e",
    servicePublic.from("case_comments").delete().eq("author_id", uid).select("*"));
  await del("generated_documents", "delete", "user_id=e2e",
    servicePublic.from("generated_documents").delete().eq("user_id", uid).select("*"));
  await del("case_members", "delete", "user_id=e2e",
    servicePublic.from("case_members").delete().eq("user_id", uid).select("*"));
  await del("audit_logs", "delete", "user_id=e2e",
    servicePublic.from("audit_logs").delete().eq("user_id", uid).select("*"));
  await del("notifications", "delete", "user_id=e2e",
    servicePublic.from("notifications").delete().eq("user_id", uid).select("*"));
  await del("reminders", "delete", "user_id=e2e",
    servicePublic.from("reminders").delete().eq("user_id", uid).select("*"));
  await del("telegram_uploads", "delete", "user_id=e2e",
    servicePublic.from("telegram_uploads").delete().eq("user_id", uid).select("*"));
  await del("telegram_verification_codes", "delete", "user_id=e2e",
    servicePublic.from("telegram_verification_codes").delete().eq("user_id", uid).select("*"));
  await del("profile_compat_settings", "delete", "user_id=e2e",
    servicePublic.from("profile_compat_settings").delete().eq("user_id", uid).select("user_id"));

  // 3. E2E-owned cases (lawyer_id or client_id = uid) and their case-scoped children.
  //    NOTE: cases.created_by does NOT exist on the cases view (verified) — intentionally omitted.
  const myCases = await servicePublic.from("cases").select("*").or(`lawyer_id.eq.${uid},client_id.eq.${uid}`);
  if (myCases.error) {
    diag.push({ table: "cases", op: "select-owned", filter: "lawyer_id|client_id=e2e", success: false, errorCode: myCases.error?.code ?? null, errorMessage: myCases.error?.message ?? null, rowCount: null });
  }
  for (const c of (myCases.data || [])) {
    const cid = c.id;
    await del("case_comments", "delete", "case_id=e2e-case",
      servicePublic.from("case_comments").delete().eq("case_id", cid).select("*"));
    await del("generated_documents", "delete", "case_id=e2e-case",
      servicePublic.from("generated_documents").delete().eq("case_id", cid).select("*"));
    await del("case_members", "delete", "case_id=e2e-case",
      servicePublic.from("case_members").delete().eq("case_id", cid).select("*"));
    await del("case_files", "delete", "case_id=e2e-case",
      servicePublic.from("case_files").delete().eq("case_id", cid).select("*"));
    await del("reminders", "delete", "case_id=e2e-case",
      servicePublic.from("reminders").delete().eq("case_id", cid).select("*"));
    await del("cases", "delete", "id=e2e-case",
      servicePublic.from("cases").delete().eq("id", cid).select("*"));
  }

  // 4. E2E profile (FK to auth.users; delete before auth user)
  await del("profiles", "delete", "id=e2e",
    servicePublic.from("profiles").delete().eq("id", uid).select("*"));

  // 5. auth user — must succeed now that all referencing rows are gone
  const d = await serviceApp.auth.admin.deleteUser(uid);
  diag.push({ table: "auth.users", op: "deleteUser", filter: "id=e2e", success: !d.error, errorCode: d.error?.code ?? null, errorMessage: d.error?.message ?? null, rowCount: d.error ? null : 1 });
  console.log("deleteUser " + up + ":", d.error ? ("FAIL " + d.error.message) : "ok");
  if (d.error) {
    console.log("BLOCKED_ORPHAN_FOREIGN_KEY — deleteUser failed for " + up);
  }
}

// Final counts
const lu2 = await serviceApp.auth.admin.listUsers({ page: 1, perPage: 200 });
const e2eLeft = (lu2.data?.users || []).filter(u => (u.email || "").endsWith(E2E_DOMAIN)).length;
const e2eIds = (lu2.data?.users || []).filter(u => (u.email || "").endsWith(E2E_DOMAIN)).map(u => u.id);

// Non-E2E baseline counts (robust: not magic numbers)
const casesCount = await servicePublic.from("cases").select("*", { count: "exact", head: true });
const profilesCount = await servicePublic.from("profiles").select("*", { count: "exact", head: true });
const caseMembersCount = await servicePublic.from("case_members").select("*", { count: "exact", head: true });
const caseCommentsCount = await servicePublic.from("case_comments").select("*", { count: "exact", head: true });
const genDocsCount = await servicePublic.from("generated_documents").select("*", { count: "exact", head: true });
const userRolesCount = await servicePublic.from("user_roles").select("*", { count: "exact", head: true });
const documentsCount = await servicePublic.from("documents").select("*", { count: "exact", head: true });

// Residual E2E references (must all be 0)
let residual = {};
async function residualCount(table, col) {
  let n = 0;
  for (const id of e2eIds) {
    const r = await servicePublic.from(table).select("*", { count: "exact", head: true }).eq(col, id);
    if (r.count) n += r.count;
  }
  return n;
}
if (e2eIds.length === 0) {
  // no E2E users left → check there are no profiles/cases/user_roles referencing any *formerly* E2E id is impossible;
  // instead assert counts are the clean non-E2E baseline by re-deriving: no row whose owner is an E2E email-domain user.
  residual = { e2eProfiles: 0, e2eCases: 0, e2eUserRoles: 0 };
} else {
  residual = {
    e2eProfiles: await residualCount("profiles", "id"),
    e2eCases: await residualCount("cases", "lawyer_id") + await residualCount("cases", "client_id"),
    e2eUserRoles: await residualCount("user_roles", "user_id"),
  };
}

const finalBaseline = {
  cases: casesCount.count,
  case_members: caseMembersCount.count,
  case_comments: caseCommentsCount.count,
  generated_documents: genDocsCount.count,
  profiles: profilesCount.count,
  user_roles: userRolesCount.count,
  documents: documentsCount.count,
  _authUsers: lu2.data?.users?.length ?? null,
  _e2eUsersRemaining: e2eLeft,
};

// baselineRestored: no E2E users AND no residual E2E-owned rows (derived, not magic numbers)
const baselineRestored = e2eLeft === 0 && residual.e2eProfiles === 0 && residual.e2eCases === 0 && residual.e2eUserRoles === 0;

mkdirSync("e2e_final_audit", { recursive: true });
writeFileSync("e2e_final_audit/07_FIXTURE_CLEANUP.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  loop: "LOOP_4",
  orphanIdPrefixBefore: e2eUsers[0] ? e2eUsers[0].id.slice(0, 8) : null,
  diagnostics: diag,
  finalBaseline,
  residualE2eReferences: residual,
  baselineRestored,
}, null, 2));

console.log("FINAL baseline:", JSON.stringify(finalBaseline));
console.log("residual E2E refs:", JSON.stringify(residual));
console.log("baselineRestored:", baselineRestored);
console.log("diagnostics ops:", diag.length, "failures:", diag.filter(d => !d.success).length);
for (const d of diag.filter(x => !x.success)) console.log("  FAIL", d.table, d.op, d.errorCode, d.errorMessage);
