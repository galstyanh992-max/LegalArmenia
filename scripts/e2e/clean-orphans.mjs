import { cleanupOrphans } from "./harness-lib.mjs";
const n = await cleanupOrphans();
console.log(JSON.stringify({ removedOrphans: n }));
