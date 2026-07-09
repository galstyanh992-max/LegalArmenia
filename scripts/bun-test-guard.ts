// Guard loaded only by `bun test` (see bunfig.toml [test].preload).
// This project's frontend tests are Vitest + jsdom suites. Bun's built-in test
// runner does not honor vitest's `environment: "jsdom"` or `vi.mock`, so every
// DOM-based suite fails with "document is not defined" when invoked via
// `bun test`. Run the canonical command instead: `npm run test` or `bun run test`.
const msg = [
  "\n[bun-test-guard] `bun test` is not supported for this repo.",
  "Frontend tests are Vitest + jsdom suites and must run via the npm script,",
  "which loads the jsdom environment. Use one of:",
  "  npm run test      # vitest run (used by CI)",
  "  bun run test      # same script via bun",
  "  npx vitest run    # direct vitest invocation",
  "Do NOT use `bun test` (bun's built-in runner) -- it skips jsdom and vi.mock.\n",
].join("\n");
console.error(msg);
process.exit(1);
