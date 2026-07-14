import type { MetricCorpusRow } from "./metric-search.ts";

export interface RerankerConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  expectedModel: string;
  expectedRevision: string;
  timeoutMs: number;
  maxBatchSize: number;
  failureThreshold: number;
  cooldownMs: number;
}

export interface RerankerScore {
  candidate_id: string;
  raw_score: number;
  normalized_score: number;
}

export interface RerankerSuccess {
  ok: true;
  model: string;
  revision: string;
  results: RerankerScore[];
  latency_ms: number;
}

export interface RerankerFailure {
  ok: false;
  reason:
    | "RERANKER_DISABLED"
    | "RERANKER_CIRCUIT_OPEN"
    | "RERANKER_TIMEOUT"
    | "RERANKER_AUTH_ERROR"
    | "RERANKER_HTTP_ERROR"
    | "RERANKER_INVALID_RESPONSE";
  latency_ms: number;
}

export type RerankerResult = RerankerSuccess | RerankerFailure;

type Fetcher = typeof fetch;
type Circuit = { failures: number; openedAt: number | null };
const circuits = new Map<string, Circuit>();

function env(name: string): string {
  return typeof Deno !== "undefined" ? (Deno.env.get(name) ?? "") : "";
}

function intEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(env(name));
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.trunc(value)))
    : fallback;
}

export function loadRerankerConfig(): RerankerConfig {
  return {
    enabled: env("LEGAL_RERANKING_ENABLED") === "true",
    endpoint: env("RERANKER_ENDPOINT").replace(/\/+$/, ""),
    apiKey: env("RERANKER_API_KEY"),
    expectedModel: env("RERANKER_MODEL_ID"),
    expectedRevision: env("RERANKER_MODEL_REVISION"),
    timeoutMs: intEnv("RERANKER_TIMEOUT_MS", 3_500, 250, 20_000),
    maxBatchSize: intEnv("RERANKER_BATCH_SIZE", 50, 1, 100),
    failureThreshold: intEnv("RERANKER_CIRCUIT_FAILURES", 3, 1, 10),
    cooldownMs: intEnv("RERANKER_CIRCUIT_COOLDOWN_MS", 60_000, 1_000, 600_000),
  };
}

function failure(
  reason: RerankerFailure["reason"],
  startedAt: number,
): RerankerFailure {
  return { ok: false, reason, latency_ms: Date.now() - startedAt };
}

function markFailure(config: RerankerConfig): void {
  const current = circuits.get(config.endpoint) ??
    { failures: 0, openedAt: null };
  current.failures += 1;
  if (current.failures >= config.failureThreshold) {
    current.openedAt = Date.now();
  }
  circuits.set(config.endpoint, current);
}

function markSuccess(config: RerankerConfig): void {
  circuits.set(config.endpoint, { failures: 0, openedAt: null });
}

function circuitOpen(config: RerankerConfig): boolean {
  const circuit = circuits.get(config.endpoint);
  if (!circuit?.openedAt) return false;
  if (Date.now() - circuit.openedAt >= config.cooldownMs) {
    circuits.set(config.endpoint, { failures: 0, openedAt: null });
    return false;
  }
  return true;
}

function trustedMetadata(row: MetricCorpusRow): Record<string, unknown> {
  return {
    norm_status: row.norm_status,
    document_type: row.citation_metadata?.legal_unit_type ?? row.content_domain,
    authority: row.source,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
  };
}

function candidateText(row: MetricCorpusRow): string {
  return [
    row.title,
    row.citation_anchor,
    row.citation_metadata?.document_number,
    row.citation_metadata?.legal_unit_title,
    row.chunk_text,
  ].filter((value): value is string =>
    typeof value === "string" && value.trim().length > 0
  ).join("\n");
}

function parseResponse(
  payload: unknown,
  ids: string[],
  config: RerankerConfig,
): RerankerSuccess | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;
  if (
    body.model !== config.expectedModel ||
    body.model_revision !== config.expectedRevision ||
    !Array.isArray(body.results)
  ) return null;
  const expected = new Set(ids);
  const seen = new Set<string>();
  const parsed: RerankerScore[] = [];
  for (const item of body.results) {
    if (!item || typeof item !== "object") return null;
    const value = item as Record<string, unknown>;
    const id = value.candidate_id;
    const raw = value.raw_score;
    const normalized = value.normalized_score;
    if (typeof id !== "string" || !expected.has(id) || seen.has(id)) {
      return null;
    }
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    if (
      typeof normalized !== "number" || !Number.isFinite(normalized) ||
      normalized < 0 || normalized > 1
    ) return null;
    seen.add(id);
    parsed.push({
      candidate_id: id,
      raw_score: raw,
      normalized_score: normalized,
    });
  }
  if (seen.size !== expected.size) return null;
  const byId = new Map(parsed.map((score) => [score.candidate_id, score]));
  return {
    ok: true,
    model: body.model as string,
    revision: body.model_revision as string,
    results: ids.map((id) => byId.get(id)!),
    latency_ms: 0,
  };
}

export async function requestRerank(
  query: string,
  rows: MetricCorpusRow[],
  options: { config?: RerankerConfig; fetcher?: Fetcher } = {},
): Promise<RerankerResult> {
  const startedAt = Date.now();
  const config = options.config ?? loadRerankerConfig();
  if (
    !config.enabled || !config.endpoint || !config.apiKey ||
    !config.expectedModel || !config.expectedRevision
  ) {
    return failure("RERANKER_DISABLED", startedAt);
  }
  if (circuitOpen(config)) return failure("RERANKER_CIRCUIT_OPEN", startedAt);
  const candidates = rows.slice(0, config.maxBatchSize).map((row) => ({
    candidate_id: row.chunk_id,
    text: candidateText(row),
    trusted_metadata: trustedMetadata(row),
  }));
  const ids = candidates.map((candidate) => candidate.candidate_id);
  if (!ids.length || new Set(ids).size !== ids.length) {
    markFailure(config);
    return failure("RERANKER_INVALID_RESPONSE", startedAt);
  }
  const fetcher = options.fetcher ?? fetch;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetcher(`${config.endpoint}/rerank`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({ query, candidates }),
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        markFailure(config);
        return failure("RERANKER_AUTH_ERROR", startedAt);
      }
      if (!response.ok) {
        if (attempt === 0 && response.status >= 500) continue;
        markFailure(config);
        return failure("RERANKER_HTTP_ERROR", startedAt);
      }
      const parsed = parseResponse(await response.json(), ids, config);
      if (!parsed) {
        markFailure(config);
        return failure("RERANKER_INVALID_RESPONSE", startedAt);
      }
      markSuccess(config);
      return { ...parsed, latency_ms: Date.now() - startedAt };
    } catch (error) {
      const timedOut = error instanceof DOMException &&
        error.name === "AbortError";
      if (attempt === 0) continue;
      markFailure(config);
      return failure(
        timedOut ? "RERANKER_TIMEOUT" : "RERANKER_HTTP_ERROR",
        startedAt,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  markFailure(config);
  return failure("RERANKER_HTTP_ERROR", startedAt);
}

export function resetRerankerCircuitsForTests(): void {
  circuits.clear();
}
