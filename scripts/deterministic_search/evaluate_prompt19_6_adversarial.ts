import { parseLegalProvision } from "../../supabase/functions/_shared/legal-provision-parser.ts";
import { sanitizeRankingText } from "../../supabase/functions/_shared/injection-sanitizer.ts";
import { rankDeterministicV3 } from "../../supabase/functions/_shared/deterministic-search-v3.ts";
import type { MetricCorpusRow } from "../../supabase/functions/_shared/metric-search.ts";

const root = new URL("../../AUDIT_REPORTS/artifacts/", import.meta.url);
const jsonl = (await Deno.readTextFile(new URL("prompt19_6_injection_dataset.jsonl", root))).trim().split(/\r?\n/).map((line) => JSON.parse(line));
const parser = JSON.parse(await Deno.readTextFile(new URL("prompt19_6_parser_fixtures.json", root)));
function row(id: string, text: string, trusted: boolean, similarity: number): MetricCorpusRow {
  return {
    chunk_id: id, document_id: `doc-${id}`, version_id: `version-${id}`, chunk_text: text,
    title: trusted ? "Trusted Act" : "Untrusted Body", source: "ARLIS", language: "hy",
    content_domain: "knowledge_base", norm_status: "active", effective_from: null, effective_to: null,
    status_scope: "current", status_eligible: true, legal_status_warning: null, status_reason_code: "active",
    vector_similarity: similarity, fts_rank: similarity, identifier_match: 0, identifier_rank: null,
    ann_rank: trusted ? 2 : 1, fts_rank_position: trusted ? 2 : 1, rrf_score: 0.03,
    duplicate_group: id, source_url: "https://www.arlis.am/DocumentView.aspx?DocID=71",
    citation_anchor: null, citation_metadata: trusted ? { article_number: "71", part_number: "2", authority: "Parliament" } : {},
  };
}
let attacks = 0, detected = 0, attackSuccess = 0, controls = 0, falsePositive = 0, forgedFeatureBlocked = 0;
let withoutSanitizerSuccess = 0, withoutPenaltySuccess = 0, withoutTrustSuccess = 0;
const failed: string[] = [];
for (const fixture of jsonl) {
  const sanitized = sanitizeRankingText(fixture.text);
  if (fixture.expected_attack) {
    attacks++;
    if (sanitized.instruction_like_score > 0) detected++;
    const ranked = rankDeterministicV3(fixture.query, [row(fixture.id, fixture.text, false, 0.99), row(`trusted-${fixture.id}`, "Article 71 legal rule", true, 0.45)], { statusScope: "current" });
    if (ranked[0]?.row.chunk_id === fixture.id) { attackSuccess++; failed.push(fixture.id); }
    if (ranked[0]?.provision_match.metadata_confidence !== "low") forgedFeatureBlocked++;
    const candidates = [row(fixture.id, fixture.text, false, 0.99), row(`trusted-${fixture.id}`, "Article 71 legal rule", true, 0.45)];
    if (rankDeterministicV3(fixture.query, candidates, { statusScope: "current", injectionSanitization: false })[0]?.row.chunk_id === fixture.id) withoutSanitizerSuccess++;
    if (rankDeterministicV3(fixture.query, candidates, { statusScope: "current", instructionPenalty: false })[0]?.row.chunk_id === fixture.id) withoutPenaltySuccess++;
    if (rankDeterministicV3(fixture.query, candidates, { statusScope: "current", trustedMetadataRestrictions: false })[0]?.row.chunk_id === fixture.id) withoutTrustSuccess++;
  } else {
    controls++;
    if (sanitized.instruction_like_score > 0) falsePositive++;
  }
}
let tp = 0, fn = 0, fp = 0, tn = 0;
for (const fixture of parser) {
  const parsed = parseLegalProvision(fixture.text);
  const pass = fixture.positive ? parsed.article === fixture.expected.article : parsed.provision_key === "";
  if (fixture.positive) {
    if (pass) tp++; else fn++;
  } else {
    if (pass) tn++; else fp++;
  }
}
const metrics = {
  dataset_cases: jsonl.length, attack_cases: attacks, legal_imperative_controls: controls,
  injection_ranking_pass: attacks ? (attacks - attackSuccess) / attacks : 1,
  attack_success_rate: attacks ? attackSuccess / attacks : 0,
  injection_detection_recall: attacks ? detected / attacks : 1,
  genuine_legal_imperative_false_positive_rate: controls ? falsePositive / controls : 0,
  forged_feature_block_rate: attacks ? forgedFeatureBlocked / attacks : 1,
  ablation_attack_success_rate: {
    without_sanitizer: attacks ? withoutSanitizerSuccess / attacks : 0,
    without_instruction_penalty: attacks ? withoutPenaltySuccess / attacks : 0,
    without_trusted_metadata_restrictions: attacks ? withoutTrustSuccess / attacks : 0,
  },
  parser_precision: tp + fp ? tp / (tp + fp) : 1, parser_recall: tp + fn ? tp / (tp + fn) : 1,
  parser_true_positive: tp, parser_false_negative: fn, parser_false_positive: fp, parser_true_negative: tn,
  failed_ids: failed,
};
await Deno.writeTextFile(new URL("prompt19_6_adversarial_metrics.json", root), JSON.stringify(metrics, null, 2) + "\n");
console.log(JSON.stringify(metrics, null, 2));
