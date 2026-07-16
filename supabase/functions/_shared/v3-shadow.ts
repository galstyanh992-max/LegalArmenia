// =============================================================================
// V3 SHADOW MODE (Stage B) ? additive, feature-flagged, failure-isolated.
//
// Purpose: run search_legal_corpus_metric_v3 as a non-primary shadow against the
// same query used by the current primary (search_legal_corpus_metric), compare
// results, and emit telemetry only. The primary response is NEVER altered,
// replaced, or delayed by shadow failure. Shadow is OFF by default.
//
// Hard rules enforced here:
//   * Default OFF: LEGAL_SEARCH_V3_SHADOW must === "true" to run.
//   * V3 is never primary in Stage A (LEGAL_SEARCH_V3_PRIMARY defaults false).
//   * V3 is called server-side only, with the service_role key, never from the
//     browser and never with authenticated/anon EXECUTE.
//   * Tenant authority comes from backend context (request_id + service_role),
//     never from a client-supplied body user_id.
//   * Telemetry contains NO PII: no access tokens, no service-role key, no full
//     case document text, no full prompts. Only chunk_id lists, counts, deltas,
//     latency, and an error class string. safe-logger redacts on top of this.
//   * A hard timeout bounds shadow latency; on timeout/error the primary
//     response is unaffected.
//
// This module does NOT modify metric-search.ts (V2) or any existing RPC call.
// =============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { log, warn } from "./safe-logger.ts";

export type StatusScope = "current" | "extended" | "historical";
export type ContentDomain = "knowledge_base" | "practice" | null;

export interface V3ShadowFlags {
  /** LEGAL_SEARCH_V3_SHADOW === "true" ? master switch, default false. */
  shadowEnabled: boolean;
  /** LEGAL_SEARCH_V3_PRIMARY === "true" ? Stage A/B cutover switch, default false. */
  v3Primary: boolean;
  /** LEGAL_SEARCH_PRIMARY ? informational label, default "metric". */
  primary: string;
  /** LEGAL_SEARCH_V3_TRAFFIC_PERCENT ? 0..100, default 0. */
  trafficPercent: number;
}

export function readV3ShadowFlags(): V3ShadowFlags {
  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  const pctRaw = Number(env("LEGAL_SEARCH_V3_TRAFFIC_PERCENT"));
  const trafficPercent = Number.isFinite(pctRaw)
    ? Math.min(Math.max(Math.trunc(pctRaw), 0), 100)
    : 0;
  return {
    shadowEnabled: env("LEGAL_SEARCH_V3_SHADOW") === "true",
    v3Primary: env("LEGAL_SEARCH_V3_PRIMARY") === "true",
    primary: env("LEGAL_SEARCH_PRIMARY") || "metric",
    trafficPercent,
  };
}

/** Deterministic-per-request sampling so a shadow run is stable within one request. */
function shouldSample(trafficPercent: number, requestId: string): boolean {
  if (trafficPercent >= 100) return true;
  if (trafficPercent <= 0) return false;
  let hash = 0;
  for (let i = 0; i < requestId.length; i++) {
    hash = (hash * 31 + requestId.charCodeAt(i)) >>> 0;
  }
  return (hash % 100) < trafficPercent;
}

function vectorArg(vector: number[] | null): string | null {
  return Array.isArray(vector) && vector.length === 1024
    ? `[${vector.join(",")}]`
    : null;
}

export interface V3ShadowInput {
  supabaseUrl: string;
  serviceRoleKey: string;
  requestId: string;
  query: string;
  embedding: number[] | null;
  contentDomain: ContentDomain;
  statusScope: StatusScope;
  effectiveAt: string | null;
  limit: number;
  annLimit: number;
  ftsLimit: number;
  provisionQuery?: string | null;
  /** Primary chunk_ids in rank order (no PII ? opaque corpus ids). */
  primaryChunkIds: string[];
  primaryRoute: string;
  /** Hard timeout for the shadow call, ms. Default 4000. */
  timeoutMs?: number;
  /**
   * Optional test-only RPC override. When provided, the shadow uses this instead
   * of constructing a Supabase client, so unit tests run without network/keys.
   * Production callers MUST NOT set this.
   */
  rpcCall?: (params: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
}

export type V3ShadowStatus = "ok" | "error" | "timeout" | "skipped";

export interface V3ShadowTelemetry {
  request_id: string;
  shadow: "v3";
  shadow_enabled: boolean;
  v3_primary: boolean;
  primary_route: string;
  status: V3ShadowStatus;
  v3_result_count: number;
  primary_count: number;
  overlap_at_5: number;
  overlap_at_10: number;
  rank_delta_top1: number | null;
  no_answer_disagreement: boolean | null;
  latency_ms: number;
  v3_error_class: string | null;
  sampled: boolean;
  ts: string;
}

interface V3Row {
  chunk_id: string;
  score?: number;
  status_eligible?: boolean;
}

/**
 * Run the V3 shadow comparison. Always resolves; never throws into the caller.
 * Returns the telemetry object that was emitted (useful for tests). When shadow
 * is disabled or not sampled, it returns a "skipped" telemetry and does no RPC.
 */
export async function runV3Shadow(input: V3ShadowInput): Promise<V3ShadowTelemetry> {
  const flags = readV3ShadowFlags();
  const ts = new Date().toISOString();
  const base: V3ShadowTelemetry = {
    request_id: input.requestId,
    shadow: "v3",
    shadow_enabled: flags.shadowEnabled,
    v3_primary: flags.v3Primary,
    primary_route: input.primaryRoute,
    status: "skipped",
    v3_result_count: 0,
    primary_count: input.primaryChunkIds.length,
    overlap_at_5: 0,
    overlap_at_10: 0,
    rank_delta_top1: null,
    no_answer_disagreement: null,
    latency_ms: 0,
    v3_error_class: null,
    sampled: false,
    ts,
  };

  if (!flags.shadowEnabled) return base;
  const sampled = shouldSample(flags.trafficPercent, input.requestId);
  if (!sampled) return base;
  base.sampled = true;

  // V3 must never be exposed as primary while Stage A is in effect. This is a
  // defense-in-depth guard: even if a flag is misconfigured, we refuse to run a
  // primary swap from inside the shadow path.
  if (flags.v3Primary) {
    warn("v3-shadow", "v3_primary=true but shadow path cannot promote V3; skipping", {
      request_id: input.requestId,
    });
    base.status = "skipped";
    return base;
  }

  const timeoutMs = Math.min(Math.max(input.timeoutMs ?? 4000, 500), 10_000);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let client: SupabaseClient | null = null;
  try {
    const rpcParams = {
      p_query_text: input.query,
      p_metric_embedding: vectorArg(input.embedding),
      p_content_domain: input.contentDomain,
      p_status_scope: input.statusScope,
      p_effective_at: input.effectiveAt ?? null,
      p_limit: Math.min(Math.max(Math.trunc(input.limit), 1), 50),
      p_ann_limit: Math.min(Math.max(Math.trunc(input.annLimit), 20), 200),
      p_fts_limit: Math.min(Math.max(Math.trunc(input.ftsLimit), 10), 100),
      p_provision_query: input.provisionQuery ?? null,
    };
    // Production uses a service-role Supabase client; tests inject rpcCall to
    // avoid network/secret dependencies. V3 is never called from the browser.
    const rpcPromise = input.rpcCall
      ? Promise.resolve(input.rpcCall(rpcParams))
      : (async () => {
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.91.1");
          client = createClient(input.supabaseUrl, input.serviceRoleKey, {
            db: { schema: "public" },
            global: {
              headers: { "x-statement-timeout": String(Math.max(Math.trunc(timeoutMs), 1000)) },
            },
          });
          return client!.rpc("search_legal_corpus_metric_v3", rpcParams);
        })();

    // Race the RPC against the abort timeout.
    const result = (await Promise.race([
      rpcPromise.then((r) => ({ r, aborted: false })),
      new Promise<{ r: null; aborted: true }>((resolve) =>
        controller.signal.addEventListener("abort", () => resolve({ r: null, aborted: true })),
      ),
    ])) as { r: { data: unknown; error: { message?: string } | null } | null; aborted: boolean };

    const latency_ms = Date.now() - started;
    base.latency_ms = latency_ms;

    if (result.aborted) {
      base.status = "timeout";
      base.v3_error_class = "SHADOW_TIMEOUT";
      emitTelemetry(base);
      return base;
    }

    const { data, error } = result.r ?? { data: null, error: { message: "no response" } };
    if (error) {
      base.status = "error";
      base.v3_error_class = classifyError(error.message);
      emitTelemetry(base);
      return base;
    }

    const v3Rows = (Array.isArray(data) ? (data as V3Row[]) : []);
    base.v3_result_count = v3Rows.length;
    const v3Ids = v3Rows.map((r) => r.chunk_id).filter(Boolean);
    base.overlap_at_5 = overlapAtK(input.primaryChunkIds, v3Ids, 5);
    base.overlap_at_10 = overlapAtK(input.primaryChunkIds, v3Ids, 10);
    base.rank_delta_top1 = rankDeltaTop1(input.primaryChunkIds, v3Ids);
    base.no_answer_disagreement =
      input.primaryChunkIds.length === 0 ? v3Ids.length > 0 : v3Ids.length === 0;
    base.status = "ok";
    emitTelemetry(base);
    return base;
  } catch (error) {
    base.latency_ms = Date.now() - started;
    base.status = "error";
    base.v3_error_class = classifyError(error instanceof Error ? error.message : String(error));
    emitTelemetry(base);
    return base;
  } finally {
    clearTimeout(timer);
  }
}

function overlapAtK(primary: string[], v3: string[], k: number): number {
  const a = primary.slice(0, k);
  const set = new Set(v3.slice(0, k));
  if (a.length === 0) return 0;
  let hit = 0;
  for (const id of a) if (set.has(id)) hit++;
  return hit;
}

function rankDeltaTop1(primary: string[], v3: string[]): number | null {
  if (primary.length === 0 && v3.length === 0) return null;
  const pTop = primary[0] ?? null;
  const vTop = v3[0] ?? null;
  if (pTop == null && vTop == null) return null;
  if (pTop === vTop) return 0;
  const vIdx = v3.indexOf(pTop);
  if (vIdx === -1) return null; // primary top not found in V3 ? report as null (regression flag upstream)
  return vIdx; // 0 means same top; >0 means primary's top is ranked lower in V3
}

function classifyError(msg?: string): string {
  const m = String(msg ?? "").toUpperCase();
  if (m.includes("TIMEOUT") || m.includes("CANCEL") || m.includes("ABORT")) return "SHADOW_TIMEOUT";
  if (m.includes("PERMISSION") || m.includes("42501") || m.includes("UNAUTHORIZED")) return "SHADOW_PERMISSION";
  if (m.includes("P0001")) return "SHADOW_RAISE";
  return "SHADOW_RPC_ERROR";
}

function emitTelemetry(t: V3ShadowTelemetry): void {
  // Telemetry carries only opaque chunk_id-free aggregates and an error class.
  // safe-logger applies PII redaction on top; no tokens/keys/prompts are present.
  log("v3-shadow", "shadow telemetry", {
    request_id: t.request_id,
    shadow: t.shadow,
    shadow_enabled: t.shadow_enabled,
    v3_primary: t.v3_primary,
    primary_route: t.primary_route,
    status: t.status,
    v3_result_count: t.v3_result_count,
    primary_count: t.primary_count,
    overlap_at_5: t.overlap_at_5,
    overlap_at_10: t.overlap_at_10,
    rank_delta_top1: t.rank_delta_top1,
    no_answer_disagreement: t.no_answer_disagreement,
    latency_ms: t.latency_ms,
    v3_error_class: t.v3_error_class,
    sampled: t.sampled,
  });
}
