import { createIdentity, signInAs, deleteUser, createdUsers, cleanupOrphans, RUN_PREFIX } from "./harness-lib.mjs";
import { servicePublic } from "./staging-client.mjs";
await cleanupOrphans();
const me = await createIdentity("client", { fullName: "EscProbe" });
const s = await signInAs(me.email, me.password);
console.log("sign-in:", s.error ? ("ERR " + s.error) : "ok");
// before
const before = await servicePublic.from("profiles").select("id,role,app_role").eq("id", me.userId).single();
console.log("before role row:", JSON.stringify(before.data));
// attempt escalation via public.profiles update {role:"admin"}
const upd = await s.public.from("profiles").update({ role: "admin" }).eq("id", me.userId).select("id,role");
console.log("update returned:", JSON.stringify(upd.data), "err:", upd.error?.message);
// re-read actual role from DB (service role, authoritative)
const after = await servicePublic.from("profiles").select("id,role").eq("id", me.userId).single();
console.log("after role row:", JSON.stringify(after.data));
const escalated = after.data?.role === "admin";
console.log("ESCALATED:", escalated);
// also try via RPC admin_set_user_role as client (should 42501)
const rpc = await s.public.rpc("admin_set_user_role", { p_user_id: me.userId, p_role: "admin" });
console.log("client rpc admin_set_user_role err:", rpc.error?.code, rpc.error?.message);
await deleteUser(me.userId);
console.log("done");
