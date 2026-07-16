import { readFile, writeFile } from "node:fs/promises";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) result[argv[index].slice(2)] = argv[++index];
  }
  for (const name of ["gold", "train", "dev", "output"]) if (!result[name]) throw new Error(`--${name} required`);
  return result;
}

async function jsonl(path) {
  return (await readFile(path, "utf8")).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(JSON.parse);
}

function evaluate(golds, runMap, threshold) {
  let answerable = 0;
  let unanswerable = 0;
  let falseNegative = 0;
  let hallucination = 0;
  for (const gold of golds) {
    const run = runMap.get(gold.query_id);
    const hardReasons = (run.no_answer_reasons ?? []).filter((reason) =>
      reason !== "CALIBRATED_SUPPORT_BELOW_THRESHOLD" &&
      reason !== "RERANKER_UNAVAILABLE_LOW_DETERMINISTIC_SUPPORT"
    );
    const predictsNoAnswer = hardReasons.length > 0 || Number(run.support_score ?? 0) < threshold;
    if (gold.answerable) {
      answerable += 1;
      if (predictsNoAnswer) falseNegative += 1;
    } else {
      unanswerable += 1;
      if (!predictsNoAnswer) hallucination += 1;
    }
  }
  return {
    threshold,
    answerable,
    unanswerable,
    no_answer_false_negative_rate: falseNegative / Math.max(1, answerable),
    no_answer_hallucination_rate: hallucination / Math.max(1, unanswerable),
  };
}

const args = parseArgs(process.argv.slice(2));
const gold = await jsonl(args.gold);
const trainResult = JSON.parse(await readFile(args.train, "utf8"));
const devResult = JSON.parse(await readFile(args.dev, "utf8"));
const trainMap = new Map(trainResult.runs.map((run) => [run.query_id, run]));
const devMap = new Map(devResult.runs.map((run) => [run.query_id, run]));
const trainGold = gold.filter((item) => item.split === "train");
const devGold = gold.filter((item) => item.split === "dev");
const trials = [];
for (let value = 20; value <= 80; value += 1) {
  const threshold = value / 100;
  trials.push({ threshold, train: evaluate(trainGold, trainMap, threshold), dev: evaluate(devGold, devMap, threshold) });
}
const eligible = trials.filter((trial) => trial.train.no_answer_hallucination_rate <= 0.02 && trial.dev.no_answer_hallucination_rate <= 0.02);
eligible.sort((left, right) =>
  left.dev.no_answer_false_negative_rate - right.dev.no_answer_false_negative_rate ||
  left.train.no_answer_false_negative_rate - right.train.no_answer_false_negative_rate ||
  right.threshold - left.threshold
);
if (!eligible.length) throw new Error("no train/dev threshold meets hallucination gate");
const selected = eligible[0];
const output = {
  evidence_class: "PROVISIONAL_NON_EXPERT_TRAIN_DEV_ONLY",
  release_eligible: false,
  test_split_used_for_tuning: false,
  selected_threshold: selected.threshold,
  selected_train_metrics: selected.train,
  selected_dev_metrics: selected.dev,
  independent_signals: [
    "retrieval_relevance",
    "status_eligibility",
    "authority",
    "evidence_sufficiency",
    "contradiction",
    "citation_support",
  ],
  hard_guards: ["STATUS_INELIGIBLE", "EXACT_LOOKUP_UNSUPPORTED", "CURRENT_SCOPE_ONLY_NONCURRENT_SUPPORT"],
  trials,
};
await writeFile(args.output, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ selected_threshold: output.selected_threshold, train: output.selected_train_metrics, dev: output.selected_dev_metrics }, null, 2));
