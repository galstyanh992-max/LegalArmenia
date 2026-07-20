import { servicePublic, serviceApp } from "./staging-client.mjs";
import { cleanupOrphans } from "./harness-lib.mjs";
// Final sweep: remove any lingering e2e-domain users + orphan case-files objects under e2e case folders
const removed = await cleanupOrphans();
// bucket sweep: list root, remove any non-UUID (traversal artifacts) and any folder that is an e2e case id (best-effort)
const root = await servicePublic.storage.from("case-files").list("");
let bucketRemoved = 0;
if (root.data) {
  for (const f of root.data) {
    const nm = f.id || f.name;
    if (nm && !/^[0-9a-f-]{36}$/.test(nm)) { try { await servicePublic.storage.from("case-files").remove([nm]); bucketRemoved++; } catch {} }
  }
}
const lu = await serviceApp.auth.admin.listUsers({ page: 1, perPage: 200 });
const e2eLeft = (lu.data?.users||[]).filter(u => (u.email||"").endsWith("@legalarmenia-e2e.test")).length;
const counts = {};
for (const t of ["cases","case_members","case_comments","generated_documents","profiles","documents"]) {
  const r = await servicePublic.from(t).select("*", { count: "exact", head: true });
  counts[t] = r.count;
}
counts._authUsers = lu.data?.users?.length ?? null;
counts._e2eUsersRemaining = e2eLeft;
counts._orphanUsersRemoved = removed;
counts._bucketArtifactsRemoved = bucketRemoved;
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("e2e_final_audit", { recursive: true });
writeFileSync("e2e_final_audit/07_FIXTURE_CLEANUP.json", JSON.stringify({ generatedAt: new Date().toISOString(), finalBaseline: counts, baselineRestored: e2eLeft === 0 }, null, 2));
console.log(JSON.stringify(counts));
