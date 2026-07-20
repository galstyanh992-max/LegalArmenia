import { createIdentity, signInAs, deleteUser, cleanupOrphans } from "./harness-lib.mjs";
await cleanupOrphans();
const me = await createIdentity("client", { active: false, fullName: "DisabledProbe" });
const s = await signInAs(me.email, me.password);
console.log("disabled sign-in:", s.error ? ("ERR " + s.error) : "ok token len=" + (s.accessToken?.length));
// protected read as disabled
const r = await s.public.from("profiles").select("id", { count: "exact", head: true });
console.log("disabled profiles read count:", r.count, "err:", r.error?.message);
await deleteUser(me.userId);
console.log("done");
