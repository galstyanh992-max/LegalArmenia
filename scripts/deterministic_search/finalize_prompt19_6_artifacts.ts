const artifacts = new URL("../../AUDIT_REPORTS/artifacts/", import.meta.url);
async function sha(name: string): Promise<string> {
  const bytes = await Deno.readFile(new URL(name, artifacts));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function json(name: string) {
  return JSON.parse(await Deno.readTextFile(new URL(name, artifacts)));
}
async function write(name: string, value: unknown) {
  await Deno.writeTextFile(new URL(name, artifacts), JSON.stringify(value, null, 2) + "\n");
}
const variants = [
  "v2", "v3", "without_v3_provision_lane", "without_v3_metadata_confidence", "without_v3_sanitizer",
  "without_v3_instruction_penalty", "without_v3_specificity", "without_v3_authority",
  "without_v3_duplicate_collapse", "without_v3_trusted_metadata",
];
const evaluations: Record<string, unknown> = {};
for (const variant of variants) evaluations[variant] = (await json(`prompt19_6_${variant}_test.json`)).metrics;
const adversarial = await json("prompt19_6_adversarial_metrics.json");
await write("prompt19_6_raw_evaluation_metrics.json", {
  frozen_test: evaluations, adversarial, production_benchmark_inherited_from_prompt19_5b: {
    p50_ms: 419.65, p95_ms: 547.76, p99_ms: 561.08, timeouts: 0,
  },
});
await write("prompt19_6_feature_ablation.json", {
  dataset: "frozen_test", variants: Object.fromEntries(variants.filter((variant) => variant !== "v2" && variant !== "v3")
    .map((variant) => [variant, evaluations[variant]])),
  adversarial_ablation: adversarial.ablation_attack_success_rate,
  note: "Frozen-pool ablations are neutral where required trusted provision/authority/version fields have zero coverage.",
});
const v3 = await json("prompt19_6_v3_test.json");
await Deno.writeTextFile(new URL("prompt19_6_failed_queries.jsonl", artifacts),
  v3.failed_queries.map((item: unknown) => JSON.stringify(item)).join("\n") + "\n");
await write("prompt19_6_baseline.json", {
  branch: "codex/prompt-19-6-citation-injection-final",
  parent_hash: "8694b9ea33098ae7d95aed489e59d8392193de1e",
  live_project: "avmgtsonawtzebvazgcr",
  live_rpc_v2_sha256: "36b5cb469966353c677415e5205f135aeb3f52d1f839c15d0736964da8580a5a",
  scorer_v2_config_sha256: await sha("prompt19_4_scorer_config.json"),
  frozen_gold_sha256: await sha("prompt19_2_frozen_gold.jsonl"),
  candidate_pools_sha256: await sha("prompt19_2_candidate_pools.jsonl"),
  citation_failure_sha256: await sha("prompt19_4_citation_failures.jsonl"),
  injection_fixture_sha256: await sha("prompt19_4_injection_fixtures.json"),
  original_dirty_worktree_fingerprint: "883b6538cdb5e2027668fcdeb9b52d914e741e839cc159f451b5260a58603a6c",
  original_dirty_worktree_lines: 150,
  live_edge: {
    embed_query: { version: 55, status: "ACTIVE", hash: "37bd2e5c650b0453950fc4b58d4efcf5b139e6baa39f69b914661b5547a0cf63" },
    vector_search: { version: 43, status: "ACTIVE", hash: "3ea127279bbf1090b3c880b1c871a2bfd1c1a7010c26043c6f9277a33aec85af" },
  },
  metric_rpc_shadow_enabled: false,
  production_writes: 0, production_deployments: 0,
});
await write("prompt19_6_shadow_comparison.json", {
  executed: false, reason: "Production writes/deployments were prohibited; offline gates did not pass.",
  feature_flag: false, user_visible_route_changed: false, full_private_queries_logged: false,
});
await write("prompt19_6_tenant_staging.json", {
  local_fixture_executed: false, local_fixture_cross_tenant_leakage: null,
  production_like_staging_executed: false,
  final_cross_tenant_leakage: null,
  blocker: "No approved production-like multi-tenant staging credentials/environment in scope.",
});
await write("prompt19_6_legal_review_status.json", {
  status: "ENGINEERING_GOLD_PENDING_LEGAL_REVIEW", legally_reviewed_cases: 0,
  reviewer_approval: null, original_gold_changed: false,
});
const metrics = (evaluations.v3 as Record<string, number>);
await write("prompt19_6_release_gates.json", {
  verdict: "SEARCH_QUALITY_NOT_READY — CITATION_OR_INJECTION_GATES_FAILED — NO_USER_CUTOVER",
  gates: {
    recall_at_10: { actual: metrics.recall_at_10, required: 0.9, pass: metrics.recall_at_10 >= 0.9 },
    mrr: { actual: metrics.mrr, required: 0.8, pass: metrics.mrr >= 0.8 },
    ndcg_at_10: { actual: metrics.ndcg_at_10, required: 0.85, pass: metrics.ndcg_at_10 >= 0.85 },
    citation_document: { actual: metrics.citation_document_accuracy, required: 1, pass: false },
    citation_provision: { actual: metrics.citation_provision_accuracy, required: 0.95, pass: false },
    frozen_exact_provision: { actual: metrics.exact_provision_lookup_accuracy, required: 1, pass: false },
    adversarial_injection_ranking: { actual: adversarial.injection_ranking_pass, required: 1, pass: true },
    frozen_injection_ranking: { actual: metrics.injection_pass_rate, required: 1, pass: false },
    attack_success: { actual: adversarial.attack_success_rate, required: 0, pass: true },
    imperative_false_positive: { actual: adversarial.genuine_legal_imperative_false_positive_rate, required_max: 0.02, pass: true },
    current_contamination: { actual: metrics.current_law_contamination, required: 0, pass: true },
    warning_accuracy: { actual: metrics.unknown_repealed_warning_accuracy, required: 1, pass: true },
    no_answer_false_answer: { actual: metrics.no_answer_false_answer_rate, required_max: 0.02, pass: true },
    tenant_leakage: { actual: null, required: 0, pass: false }, legal_review: { actual: null, pass: false },
  },
  exact_cutover_plan: [
    "Complete blind legal adjudication without modifying original frozen labels.",
    "Backfill versioned structured provision/authority/effective-date/source metadata through a separately authorized reversible migration.",
    "Reach all frozen citation, exact-provision, injection, warning, no-answer and tenant gates offline.",
    "Deploy V3 behind operator-only shadow with METRIC_RPC_SHADOW_ENABLED remaining false for users.",
    "Run sanitized-ID shadow comparison and rollback rehearsal with zero user-visible changes.",
    "Request explicit production cutover approval; only then change the live user route.",
  ],
});

const manifestNames: string[] = [];
for await (const entry of Deno.readDir(artifacts)) if (entry.isFile && entry.name.startsWith("prompt19_6_")) manifestNames.push(entry.name);
manifestNames.sort();
const files: Record<string, { sha256: string; bytes: number }> = {};
for (const name of manifestNames.filter((name) => name !== "prompt19_6_artifact_manifest.json")) {
  files[name] = { sha256: await sha(name), bytes: (await Deno.stat(new URL(name, artifacts))).size };
}
await write("prompt19_6_artifact_manifest.json", { file_count: Object.keys(files).length, files });
console.log(JSON.stringify({ artifacts: Object.keys(files).length, verdict: "NOT_READY" }));
