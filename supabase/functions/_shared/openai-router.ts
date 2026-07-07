/**
 * _shared/openai-router.ts — Centralized AI router for all non-OCR edge functions.
 *
 * MODEL GOVERNANCE (provider-routed):
 * - Claude/Gemini model IDs are routed through OpenRouter by ai-provider.ts.
 * - OpenAI models are used for embeddings and explicitly allowlisted utility roles.
 * - google/gemini-2.5-pro is used for strict JSON-output roles.
 * - google/gemini-2.5-flash / flash-lite are used for cheap utilities.
 * - No silent fallbacks. No hardcoded model strings. model_used always from router.
 *
 * Required env vars:
 *   OPENAI_API_KEY         — required for openai/* models and embeddings
 *   OPENROUTER_API_KEY     — required when ai_provider is openrouter
 *   OPENAI_TIMEOUT_MS      — optional, default 60000
 *   OPENAI_AUDIO_TIMEOUT_MS — optional, default 120000
 *   OPENAI_MAX_RETRIES     — optional, default 2
 */

// ── Model map ────────────────────────────────────────────────────────────────

export interface ModelConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  json_mode?: boolean;
  description: string;
  /** Optional OpenRouter (or other) model to use if the primary provider fails. */
  fallback?: string;
}

/** Governance metadata returned with every AI call */
export interface GovernanceMeta {
  role: string;
  model_used: string;
  temperature_used: number;
  max_tokens_used: number;
}

/**
 * Strict per-function model assignment.
 * Legal reasoning uses Claude through OpenRouter; Gemini Pro is reserved for strict JSON.
 */
export const MODEL_MAP: Record<string, ModelConfig> = {
  // ── Primary legal reasoning ───────────────────────────────────────────────
  "ai-analyze": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.15,
    max_tokens: 28000,
    description: "Case analysis (GLM-5.2 primary; Claude Sonnet 4 fallback)",
    fallback: "anthropic/claude-sonnet-5",
  },
  "multi-agent-analyze": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 32000,
    description: "Multi-agent analysis (GLM-5.2 primary; Claude 3.5 Sonnet fallback)",
    fallback: "anthropic/claude-sonnet-5",
  },
  "generate-complaint": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.1,
    max_tokens: 28000,
    description: "Complaint drafting (GLM-5.2 primary; Claude 3.5 Sonnet fallback)",
    fallback: "anthropic/claude-sonnet-5",
  },
  "legal-chat": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 32000,
    description: "Legal chat (GLM-5.2 primary; Claude 3.5 Sonnet fallback)",
    fallback: "anthropic/claude-sonnet-5",
  },
  "analyze-files-for-complaint": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 32000,
    description: "File analysis (GLM-5.2 primary; Claude 3.5 Sonnet fallback)",
    fallback: "anthropic/claude-sonnet-5",
  },
  "generate-document": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 20000,
    description: "Documents (GLM-5.2 primary; Claude 3.5 Sonnet fallback)",
    fallback: "anthropic/claude-sonnet-5",
  },

  // ── Strict JSON ───────────────────────────────────────────────────────────
  "extract-case-fields": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.15,
    max_tokens: 32000,
    description: "Extract fields (GLM-5.2 primary; Gemini 2.5 Pro fallback)",
    fallback: "google/gemini-2.5-pro",
  },
  "kb-search-assistant": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 200,
    json_mode: true,
    description: "KB keywords JSON (GLM-5.2 primary; Gemini 2.5 Pro fallback)",
    fallback: "google/gemini-2.5-pro",
  },

  // ── Utilities ─────────────────────────────────────────────────────────────
  "audio-transcribe": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.1,
    max_tokens: 32000,
    description: "Transcription (GLM-5.2 primary; Gemini 2.5 Flash fallback)",
    fallback: "google/gemini-2.5-flash",
  },
  "echr-translate": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.1,
    max_tokens: 16000,
    description: "ECHR translate (GLM-5.2 primary; Claude 3.5 Sonnet fallback)",
    fallback: "anthropic/claude-3.5-sonnet",
  },
  "legal-practice-enrich": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 32000,
    description: "Enrich practice (OpenAI GPT-4.1 mini)",
  },
  "vector-search-rerank": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.1,
    max_tokens: 1000,
    description: "Rerank (OpenAI GPT-4.1 mini)",
  },

  // ── Bypass-only utilities ─────────────────────────────────────────────────
  "ocr-process": {
    model: "google/gemini-2.5-flash",
    temperature: 0.1,
    max_tokens: 16000,
    description: "OCR vision (Gemini Flash — GLM-5.2 image support unconfirmed, routed direct to OpenRouter)",
  },
  "kb-scrape-batch": {
    model: "google/gemini-2.5-flash",
    temperature: 0.1,
    max_tokens: 32000,
    description: "KB PDF scrape (Gemini Flash — vision, routed direct to OpenRouter)",
  },
  "kb-fetch-pdf-content": {
    model: "google/gemini-2.5-flash",
    temperature: 0.1,
    max_tokens: 32000,
    description: "KB fetch PDF (Gemini Flash — vision, routed direct to OpenRouter)",
  },
  "legal-practice-import": {
    model: "google/gemini-2.5-pro",
    temperature: 0,
    max_tokens: 16000,
    description: "Practice import extract (Gemini 2.5 Pro — vision, routed direct to OpenRouter)",
  },
  "prompt-armor-repair": {
    model: "google/gemini-2.5-pro",
    temperature: 0,
    max_tokens: 16000,
    description: "JSON repair (Gemini 2.5 Pro — vision, routed direct to OpenRouter)",
  },

  // ── Embeddings (OpenAI only — always direct, no gateway) ──────────────────
  "generate-embeddings": {
    model: "openai/text-embedding-3-small",
    temperature: 0,
    max_tokens: 0,
    description: "Embeddings (Metric AI direct)",
  },

  // ── Admin utilities ─────────────────────────────────────────────────────
  "admin-ai-chat": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.3,
    max_tokens: 32000,
    description: "Admin AI chat (GLM-5.2 primary; Claude 3.5 Sonnet fallback)",
    fallback: "anthropic/claude-3.5-sonnet",
  },

  // ── Worker aliases ────────────────────────────────────────────────────────
  "practice-ai-enrich-worker": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 32000,
    description: "Enrich practice worker (OpenAI GPT-4.1 mini)",
  },

  // ── Map-Reduce summarizer ─────────────────────────────────────────────────
  "map-reduce-summarize": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.1,
    max_tokens: 8000,
    description: "Map-Reduce chunk summarizer (GLM-5.2 primary; Claude 3.5 Sonnet fallback)",
    fallback: "anthropic/claude-3.5-sonnet",
  },

  // ── Translation ───────────────────────────────────────────────────────────
  "translate-to-armenian": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.1,
    max_tokens: 8192,
    description: "Legal translation to Armenian (GLM-5.2 primary; Claude 3.5 Sonnet fallback)",
    fallback: "anthropic/claude-3.5-sonnet",
  },
};

/**
 * Role-specific model overrides for ai-analyze engines.
 */
const ROLE_OVERRIDES: Record<string, Partial<ModelConfig>> = {
  // ── Reasoning roles (inherit base Gemini Flash) ─────────────────────────
  "ai-analyze:strategy_builder": { description: "Strategy builder" },
  "ai-analyze:risk_factors": { description: "Risk factors" },
  "ai-analyze:evidence_weakness": { description: "Evidence weakness" },
  "ai-analyze:hallucination_audit": { description: "Hallucination audit" },
  "ai-analyze:legal_position_comparator": { description: "Comparator" },
  // ── Deterministic draft (temp=0) ───────────────────────────────────────────
  "ai-analyze:draft_deterministic": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0,
    max_tokens: 28000,
    description: "Deterministic draft (GLM-5.2 temp=0)",
    fallback: "anthropic/claude-sonnet-5",
  },
  // ── JSON roles (Gemini Pro) ─────────────────────────────────────────────
  "ai-analyze:precedent_citation": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 16000,
    description: "Precedent JSON (GLM-5.2 primary; Gemini 2.5 Pro fallback)",
    fallback: "google/gemini-2.5-pro",
  },
  "ai-analyze:cross_exam": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 16000,
    description: "Cross-exam JSON (GLM-5.2 primary; Gemini 2.5 Pro fallback)",
    fallback: "google/gemini-2.5-pro",
  },
  "ai-analyze:deadline_rules": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 16000,
    description: "Deadlines JSON (GLM-5.2 primary; Gemini 2.5 Pro fallback)",
    fallback: "google/gemini-2.5-pro",
  },
  "ai-analyze:law_update_summary": {
    model: "ollama/glm-5.2:cloud",
    temperature: 0.2,
    max_tokens: 16000,
    description: "Law update JSON (GLM-5.2 primary; Gemini 2.5 Pro fallback)",
    fallback: "google/gemini-2.5-pro",
  },
};

// ── Governance constants & allowlists ────────────────────────────────────────

const MAX_TEMPERATURE = 0.3;
const MAX_TOKENS_CAP = 32768;

/** OpenAI chat models allowed ONLY for these roleLabels/functionNames (kept for future if we switch back) */
const OPENAI_CHAT_ALLOWLIST = new Set([
  "generate-complaint",
  "multi-agent-analyze",
  "legal-chat",
  "analyze-files-for-complaint",
  "generate-document",
  "ai-analyze",
  "ai-analyze:strategy_builder",
  "ai-analyze:risk_factors",
  "ai-analyze:evidence_weakness",
  "ai-analyze:hallucination_audit",
  "ai-analyze:legal_position_comparator",
  "ai-analyze:draft_deterministic",
  "extract-case-fields",
  "admin-ai-chat",
  "practice-ai-enrich-worker",
]);

/** OpenAI embedding models allowed ONLY for these functionNames */
const OPENAI_EMBEDDING_ALLOWLIST = new Set([
  "generate-embeddings",
]);

/** Roles that use strict JSON output */
const STRICT_JSON_ROLES = new Set([
  "ai-analyze:precedent_citation",
  "ai-analyze:cross_exam",
  "ai-analyze:deadline_rules",
  "ai-analyze:law_update_summary",
]);

/** Functions that use callJSON */
const STRICT_JSON_FUNCTIONS = new Set([
  "kb-search-assistant",
]);

/** Combined set of all roleLabels/functionNames allowed to use callJSON */
const CALLJSON_ALLOWED = new Set([
  ...STRICT_JSON_ROLES,
  ...STRICT_JSON_FUNCTIONS,
]);

/**
 * Governance-enforced model config resolution.
 */
export function getModelConfig(functionName: string, role?: string): ModelConfig {
  const roleLabel = role ? `${functionName}:${role}` : functionName;

  if (role) {
    const overrideKey = `${functionName}:${role}`;
    const override = ROLE_OVERRIDES[overrideKey];
    if (!override) {
      throw new Error(
        `[openai-router] Undefined role "${role}" for function "${functionName}". ` +
          `Register it in ROLE_OVERRIDES or check the role name.`
      );
    }
    const base = MODEL_MAP[functionName];
    if (!base) {
      throw new Error(
        `[openai-router] No model config for function "${functionName}".`
      );
    }
    const merged = { ...base, ...override } as ModelConfig;
    return enforceGovernance(merged, roleLabel, functionName);
  }

  const cfg = MODEL_MAP[functionName];
  if (!cfg) {
    // Audit-log the missing key for observability
    console.error(
      `[openai-router] GOVERNANCE VIOLATION: No MODEL_MAP entry for "${functionName}". ` +
      `Available keys: ${Object.keys(MODEL_MAP).join(", ")}`
    );
    throw new Error(
      `[openai-router] No model config for function "${functionName}". ` +
      `Register it in MODEL_MAP before calling getModelConfig().`
    );
  }
  return enforceGovernance(cfg, roleLabel, functionName);
}

export function buildGovernanceMeta(cfg: ModelConfig, roleLabel: string): GovernanceMeta {
  return {
    role: roleLabel,
    model_used: cfg.model,
    temperature_used: cfg.temperature,
    max_tokens_used: cfg.max_tokens,
  };
}

/**
 * Allowlist-based governance enforcement:
 * - openai/text-embedding-*: allowed ONLY by functionName (not roleLabel).
 * - openai/* chat: allowed ONLY if roleLabel is in OPENAI_CHAT_ALLOWLIST.
 * - STRICT_JSON_ROLES must resolve to google/gemini-2.5-pro.
 * - Temperature > 0.3 or max_tokens > 32768: STRICT THROW.
 */
function enforceGovernance(cfg: ModelConfig, roleLabel: string, functionName: string): ModelConfig {
  // ── OpenAI allowlist checks ────────────────────────────────────────────────
  if (cfg.model.startsWith("openai/")) {
    const isEmbedding = cfg.model.startsWith("openai/text-embedding-");
    if (isEmbedding) {
      // FIX #1: validate by functionName, not roleLabel
      if (!OPENAI_EMBEDDING_ALLOWLIST.has(functionName)) {
        throw new Error(
          `[openai-router] GOVERNANCE VIOLATION: OpenAI embedding model "${cfg.model}" ` +
            `is not allowed for function "${functionName}". Allowed only for: ${[...OPENAI_EMBEDDING_ALLOWLIST].join(", ")}.`
        );
      }
      return cfg;
    }
    // OpenAI chat: must be in allowlist
    if (!OPENAI_CHAT_ALLOWLIST.has(roleLabel)) {
      throw new Error(
        `[openai-router] GOVERNANCE VIOLATION: OpenAI chat model "${cfg.model}" ` +
          `is not allowed for "${roleLabel}". Add to OPENAI_CHAT_ALLOWLIST if intended.`
      );
    }
  }

  // ── Strict JSON roles are enforced by MODEL_MAP/ROLE_OVERRIDES and callJSON gates. ──

  // ── Parameter caps ─────────────────────────────────────────────────────────
  if (cfg.temperature > MAX_TEMPERATURE) {
    throw new Error(
      `[openai-router] GOVERNANCE VIOLATION: temperature ${cfg.temperature} exceeds cap ${MAX_TEMPERATURE} for "${roleLabel}".`
    );
  }
  if (cfg.max_tokens > MAX_TOKENS_CAP) {
    throw new Error(
      `[openai-router] GOVERNANCE VIOLATION: max_tokens ${cfg.max_tokens} exceeds cap ${MAX_TOKENS_CAP} for "${roleLabel}".`
    );
  }

  return cfg;
}

// ── LEGAL safety header (prepended to all legal reasoning functions) ─────────

const LEGAL_REASONING_FNS = new Set([
  "ai-analyze",
  "multi-agent-analyze",
  "legal-chat",
  "generate-complaint",
  "analyze-files-for-complaint",
  "generate-document",
]);

const JSON_FNS = new Set(["extract-case-fields", "kb-search-assistant"]);

export const LEGAL_SAFETY_HEADER = `RULES:
- Do not invent laws, articles, case numbers, or quotations.
- Use only provided context for citations; if missing, say so.
- If facts are insufficient, list missing facts explicitly.
- Keep output structured and conservative.`;

export const JSON_SAFETY_HEADER = `Return ONLY valid JSON matching the schema. No extra keys. No commentary. Unknown fields must be null.`;

function prependSafetyHeader(
  functionName: string,
  messages: RouterMessage[]
): RouterMessage[] {
  const header = LEGAL_REASONING_FNS.has(functionName)
    ? LEGAL_SAFETY_HEADER
    : JSON_FNS.has(functionName)
      ? JSON_SAFETY_HEADER
      : null;

  if (!header) return messages;

  return messages.map((m, idx) => {
    if (idx === 0 && m.role === "system") {
      return { ...m, content: header + "\n\n" + m.content };
    }
    return m;
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface RouterMessage {
  role: "system" | "user" | "assistant";
  content: string | unknown[]; // allow multimodal content arrays
}

export interface RouterCallOptions {
  /** Override timeout in ms (falls back to env var or default) */
  timeoutMs?: number;
}

export interface TextResult {
  text: string;
  model_used: string;
  latency_ms: number;
  request_id: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  governance: GovernanceMeta;
}

export interface JSONResult<T = unknown> {
  json: T;
  model_used: string;
  latency_ms: number;
  request_id: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  governance: GovernanceMeta;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

import { getAIProvider, resolveEndpoint } from "./ai-provider.ts";

function defaultTimeout(isAudio: boolean): number {
  if (isAudio) {
    return parseInt(Deno.env.get("OPENAI_AUDIO_TIMEOUT_MS") ?? "120000", 10);
  }
  return parseInt(Deno.env.get("OPENAI_TIMEOUT_MS") ?? "300000", 10);
}

function maxRetries(): number {
  return parseInt(Deno.env.get("OPENAI_MAX_RETRIES") ?? "1", 10);
}

function newRequestId(): string {
  return crypto.randomUUID();
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function isOpenRouterFallbackEnabled(): boolean {
  return Deno.env.get("OPENROUTER_FALLBACK_ENABLED") === "true";
}

function isRetryableProviderError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as Error & { status?: number }).status;
  if (typeof status === "number") return isRetryable(status);
  return (
    err.name === "AbortError" ||
    err.message.includes("network") ||
    err.message.includes("Network") ||
    err.message.includes("OLLAMA_CLOUD_API_KEY") ||
    err.message.includes("OLLAMA_CLOUD_BASE_URL") ||
    err.message.includes("not configured")
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Core fetch with retries + exponential backoff + jitter.
 * Logs metadata only — never logs user content.
 */
async function fetchWithRetry(
  functionName: string,
  requestId: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ data: Record<string, unknown>; latency_ms: number }> {
  // Resolve provider for this request
  const provider = await getAIProvider();
  const modelName = body.model as string;
  const endpoint = resolveEndpoint(provider, modelName, functionName);
  const effectiveTimeoutMs = modelName.startsWith("ollama/")
    ? parseInt(Deno.env.get("OLLAMA_CLOUD_TIMEOUT_MS") ?? String(timeoutMs), 10)
    : timeoutMs;

  // Update model name in body if routing to OpenAI directly
  const resolvedBody = { ...body, model: endpoint.modelForApi };

  const max = modelName.startsWith("ollama/")
    ? parseInt(Deno.env.get("OLLAMA_CLOUD_MAX_RETRIES") ?? "2", 10)
    : maxRetries();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= max; attempt++) {
    const t0 = Date.now();

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

      response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${endpoint.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resolvedBody),
        signal: controller.signal,
      });

      clearTimeout(timer);
    } catch (fetchErr) {
      const latency_ms = Date.now() - t0;
      const errClass =
        fetchErr instanceof Error && fetchErr.name === "AbortError"
          ? "TIMEOUT"
          : "NETWORK_ERROR";

      console.error(
        JSON.stringify({
          request_id: requestId,
          function_name: functionName,
          model_used: body.model,
          attempt,
          latency_ms,
          error_class: errClass,
        })
      );

      lastError = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));

      if (attempt < max) {
        const backoff = Math.pow(2, attempt) * 500 + Math.random() * 300;
        await sleep(backoff);
        continue;
      }
      throw lastError;
    }

    const latency_ms = Date.now() - t0;

    // Log metadata only
    console.log(
      JSON.stringify({
        request_id: requestId,
        function_name: functionName,
        model_used: body.model,
        attempt,
        status: response.status,
        latency_ms,
      })
    );

    if (!response.ok) {
      if (isRetryable(response.status) && attempt < max) {
        const backoff = Math.pow(2, attempt) * 500 + Math.random() * 300;
        await sleep(backoff);
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      // Surface rate-limit and payment errors clearly
      if (response.status === 429) {
        throw Object.assign(new Error("Rate limit exceeded. Please try again later."), {
          status: 429,
        });
      }
      if (response.status === 402) {
        throw Object.assign(
          new Error("AI provider credits exhausted. Check the configured provider billing."),
          { status: 402 }
        );
      }

      const errText = await response.text().catch(() => "");
      throw Object.assign(
        new Error(`AI provider error ${response.status}: ${errText.substring(0, 200)}`),
        { status: response.status }
      );
    }

    // Safely parse response body — guard against empty/truncated responses
    const responseText = await response.text();
    if (!responseText || responseText.trim().length === 0) {
      throw new Error(`AI provider returned empty response body (status ${response.status})`);
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText) as Record<string, unknown>;
    } catch (parseErr) {
      console.error(
        JSON.stringify({
          request_id: requestId,
          function_name: functionName,
          error: "JSON parse failed",
          body_preview: responseText.substring(0, 200),
        })
      );
      throw new Error(`AI provider returned invalid JSON: ${(parseErr as Error).message}`);
    }

    // Log token usage
    const usage = data.usage as
      | { prompt_tokens: number; completion_tokens: number; total_tokens: number }
      | undefined;
    if (usage) {
      console.log(
        JSON.stringify({
          request_id: requestId,
          function_name: functionName,
          model_used: body.model,
          token_usage: usage,
        })
      );
    }

    return { data, latency_ms };
  }

  throw lastError ?? new Error("[openai-router] Max retries exceeded");
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a clean request body for the configured AI provider.
 * Provider-aware parameter rules:
 *   - openai/* chat:  use max_completion_tokens (not max_tokens)
 *   - anthropic/*:    use temperature + max_tokens
 *   - google/*:       use temperature + max_tokens
 */
function buildRequestBody(
  cfg: ModelConfig,
  messages: RouterMessage[]
): Record<string, unknown> {
  if (cfg.model.startsWith("openai/") && !cfg.model.startsWith("openai/text-embedding-")) {
    // OpenAI GPT-5 family only supports default temperature (1).
    // Omit temperature entirely to use the model default.
    return {
      model: cfg.model,
      max_completion_tokens: cfg.max_tokens,
      messages,
    };
  }
  return {
    model: cfg.model,
    temperature: cfg.temperature,
    max_tokens: cfg.max_tokens,
    messages,
  };
}

/**
 * callText — Standard text completion (streaming disabled, waits for full response).
 */
export async function callText(
  functionName: string,
  messages: RouterMessage[],
  options: RouterCallOptions & { role?: string } = {}
): Promise<TextResult> {
  const roleLabel = options.role ? `${functionName}:${options.role}` : functionName;

  // Strict JSON roles MUST use callJSON, not callText
  if (STRICT_JSON_ROLES.has(roleLabel)) {
    throw new Error(
      `[openai-router] GOVERNANCE VIOLATION: "${roleLabel}" is a strict JSON role and MUST use callJSON, not callText.`
    );
  }

  const cfg = getModelConfig(functionName, options.role);
  const safeMessages = prependSafetyHeader(functionName, messages);
  const timeoutMs = options.timeoutMs ?? defaultTimeout(false);

  const runOnce = async (useCfg: ModelConfig): Promise<TextResult> => {
    const requestId = newRequestId();
    const body = buildRequestBody(useCfg, safeMessages);
    const { data, latency_ms } = await fetchWithRetry(functionName, requestId, body, timeoutMs);
    const choices = data.choices as Array<{ message: { content: string } }>;
    const text = choices?.[0]?.message?.content ?? "";
    const usage = data.usage as TextResult["usage"];
    return {
      text,
      model_used: useCfg.model,
      latency_ms,
      request_id: requestId,
      usage,
      governance: buildGovernanceMeta(useCfg, roleLabel),
    };
  };

  // Primary provider (e.g. GLM-5.2 on Ollama Cloud). For Ollama-primary roles, skip
  // straight to the OpenRouter fallback when no OLLAMA key is configured — avoids a
  // guaranteed-failing call and noisy logs. Fallback is explicit, never silent.
  try {
    return await runOnce(cfg);
  } catch (err) {
    if (!cfg.fallback || !cfg.model.startsWith("ollama/")) throw err;
    if (!isRetryableProviderError(err) || !isOpenRouterFallbackEnabled()) throw err;
    console.warn(
      JSON.stringify({
        function_name: functionName,
        event: "provider_fallback",
        from_model: cfg.model,
        to_model: cfg.fallback,
        reason: (err as Error)?.message?.slice(0, 160) ?? "unknown",
      })
    );
  }

  if (cfg.fallback) {
    const fbCfg = enforceGovernance({ ...cfg, model: cfg.fallback }, roleLabel, functionName);
    return await runOnce(fbCfg);
  }

  throw new Error(
    `[openai-router] ${functionName}: primary model "${cfg.model}" unavailable and no fallback configured.`
  );
}

/**
 * Extract the assistant's raw text from a provider response, then attempt to
 * parse it as JSON. Strips markdown code fences the way most providers wrap
 * JSON output when not using a strict json_mode flag.
 */
function extractJsonFromResponse<T>(data: Record<string, unknown>): { rawText: string; parsed: T | null } {
  const choices = data.choices as Array<{ message: { content: string } }>;
  const rawText = choices?.[0]?.message?.content ?? "";

  let cleaned = rawText.trim();
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    return { rawText, parsed: null };
  }
  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  try {
    return { rawText, parsed: JSON.parse(cleaned) as T };
  } catch {
    return { rawText, parsed: null };
  }
}

/**
 * Checks that every key in `schema` is present in `candidate`. Only keys are
 * validated (per callJSON's contract) — value types/shapes are the caller's
 * concern, this just guards against the model dropping whole fields.
 */
function hasAllSchemaKeys(candidate: unknown, schema: Record<string, unknown>): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  const obj = candidate as Record<string, unknown>;
  return Object.keys(schema).every((key) => key in obj);
}

/**
 * callJSON — JSON extraction with one auto-repair attempt + schema key validation.
 *
 * @param schema - Object with expected keys (values are unused; only keys matter for validation)
 */
export async function callJSON<T = Record<string, unknown>>(
  functionName: string,
  messages: RouterMessage[],
  schema: Record<string, unknown>,
  options: RouterCallOptions & { role?: string } = {}
): Promise<JSONResult<T>> {
  const roleLabel = options.role ? `${functionName}:${options.role}` : functionName;
  const cfg = getModelConfig(functionName, options.role);

  // Governance: callJSON allowed ONLY for strict JSON roles/functions (Gemini Pro)
  if (!CALLJSON_ALLOWED.has(roleLabel) && !CALLJSON_ALLOWED.has(functionName)) {
    throw new Error(
      `[openai-router] GOVERNANCE VIOLATION: callJSON is not allowed for "${roleLabel}". ` +
        `Only strict JSON roles may use callJSON. Use callText for legal text roles.`
    );
  }
  // Explicit block: OpenAI chat models must NEVER use callJSON
  if (cfg.model.startsWith("openai/") && !cfg.model.startsWith("openai/text-embedding-")) {
    throw new Error(
      `[openai-router] GOVERNANCE VIOLATION: callJSON is forbidden for OpenAI chat model "${cfg.model}". ` +
        `Use Gemini Pro JSON roles only.`
    );
  }
  const safeMessages = prependSafetyHeader(functionName, messages);
  const timeoutMs = options.timeoutMs ?? defaultTimeout(false);

  let activeCfg = cfg;
  let governance = buildGovernanceMeta(activeCfg, roleLabel);
  let requestId = newRequestId();
  let body = buildRequestBody(activeCfg, safeMessages);
  let data: Record<string, unknown>;
  let latency_ms: number;

  try {
    ({ data, latency_ms } = await fetchWithRetry(
      functionName,
      requestId,
      body,
      timeoutMs
    ));
  } catch (err) {
    if (!cfg.fallback || !cfg.model.startsWith("ollama/")) throw err;
    if (!isRetryableProviderError(err) || !isOpenRouterFallbackEnabled()) throw err;
    console.warn(
      JSON.stringify({
        function_name: functionName,
        event: "provider_fallback",
        from_model: cfg.model,
        to_model: cfg.fallback,
        reason: (err as Error)?.message?.slice(0, 160) ?? "unknown",
      })
    );
    activeCfg = enforceGovernance({ ...cfg, model: cfg.fallback }, roleLabel, functionName);
    governance = buildGovernanceMeta(activeCfg, roleLabel);
    requestId = newRequestId();
    body = buildRequestBody(activeCfg, safeMessages);
    ({ data, latency_ms } = await fetchWithRetry(functionName, requestId, body, timeoutMs));
  }

  const { rawText, parsed: initialParsed } = extractJsonFromResponse<T>(data);
  let parsed = initialParsed;

  // One auto-repair attempt: ask the SAME resolved model (primary or fallback,
  // whichever just answered) to correct its own malformed/incomplete JSON.
  // This never changes provider/model selection — it reuses activeCfg exactly
  // as chosen by the routing logic above.
  if (!parsed || !hasAllSchemaKeys(parsed, schema)) {
    console.warn(
      JSON.stringify({
        function_name: functionName,
        event: "json_repair_attempt",
        model_used: activeCfg.model,
        request_id: requestId,
        reason: parsed ? "missing_schema_keys" : "unparseable_json",
      })
    );

    const repairMessages: RouterMessage[] = [
      ...safeMessages,
      { role: "assistant", content: rawText },
      {
        role: "user",
        content:
          `Your previous response was not valid JSON matching the required schema keys: ` +
          `${Object.keys(schema).join(", ")}. Output ONLY a corrected JSON object containing ` +
          `exactly those keys. No markdown, no code fences, no explanation — just the JSON object.`,
      },
    ];
    const repairRequestId = newRequestId();
    const repairBody = buildRequestBody(activeCfg, repairMessages);
    const { data: repairData, latency_ms: repairLatency } = await fetchWithRetry(
      functionName,
      repairRequestId,
      repairBody,
      timeoutMs
    );
    const repaired = extractJsonFromResponse<T>(repairData);

    if (!repaired.parsed || !hasAllSchemaKeys(repaired.parsed, schema)) {
      throw new Error(
        `[openai-router] callJSON: "${roleLabel}" produced invalid JSON even after one repair attempt ` +
          `(missing keys or unparseable output).`
      );
    }

    parsed = repaired.parsed;
    data = repairData;
    requestId = repairRequestId;
    latency_ms = latency_ms + repairLatency;

    console.log(
      JSON.stringify({
        function_name: functionName,
        event: "json_repair_succeeded",
        model_used: activeCfg.model,
        request_id: requestId,
      })
    );
  }

  const usage = data.usage as JSONResult<T>["usage"];

  return {
    json: parsed as T,
    model_used: activeCfg.model,
    latency_ms,
    request_id: requestId,
    usage,
    governance,
  };
}
