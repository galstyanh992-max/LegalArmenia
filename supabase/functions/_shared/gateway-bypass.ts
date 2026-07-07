/**
 * _shared/gateway-bypass.ts — Centralized helper for edge functions
 * that MUST call an AI provider directly (e.g. tool_calling, streaming, multimodal).
 *
 * All bypass calls MUST resolve model/temperature/max_tokens from MODEL_MAP
 * to prevent model drift. Every call is logged with bypass_reason.
 */

import { getModelConfig, type ModelConfig } from "./openai-router.ts";
import { getAIProvider, resolveEndpoint, type AIProvider } from "./ai-provider.ts";

export interface BypassOptions {
  /** Function name for MODEL_MAP lookup */
  functionName: string;
  /** Reason for bypassing the router (e.g. "tool_calling", "streaming", "multimodal") */
  bypassReason: string;
  /** Additional body fields (tools, tool_choice, stream, etc.) */
  extraBody?: Record<string, unknown>;
  /** Override timeout in ms (default 60000) */
  timeoutMs?: number;
  /** Max retries on 5xx/429 (default 0) */
  maxRetries?: number;
}

export interface BypassResult {
  data: Record<string, unknown>;
  model_used: string;
  latency_ms: number;
  request_id: string;
}

type ResolvedEndpoint = ReturnType<typeof resolveEndpoint>;

function providerForModel(model: string): AIProvider {
  if (model.startsWith("ollama/")) return "ollama_cloud";
  if (model.startsWith("openai/")) return "openai";
  return "openrouter";
}

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function resolveEndpointWithFallback(
  provider: AIProvider,
  cfg: ModelConfig,
  functionName: string,
): { endpoint: ResolvedEndpoint; modelUsed: string; usedFallback: boolean } {
  try {
    return {
      endpoint: resolveEndpoint(provider, cfg.model, functionName),
      modelUsed: cfg.model,
      usedFallback: false,
    };
  } catch (error) {
    if (!cfg.fallback) throw error;
    console.warn(
      `[gateway-bypass] Primary endpoint resolution failed for ${cfg.model}. Trying fallback ${cfg.fallback}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      endpoint: resolveEndpoint(providerForModel(cfg.fallback), cfg.fallback, functionName),
      modelUsed: cfg.fallback,
      usedFallback: true,
    };
  }
}

/**
 * Build a provider request body using MODEL_MAP config + extra fields.
 * Respects provider-aware parameter rules (max_completion_tokens for OpenAI chat).
 */
function buildBypassBody(
  cfg: ModelConfig,
  messages: Array<{ role: string; content: unknown }>,
  extraBody?: Record<string, unknown>
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.max_tokens,
  };

  // Merge extra fields (tools, tool_choice, stream, etc.)
  if (extraBody) {
    Object.assign(base, extraBody);
  }

  return base;
}

/**
 * Execute a provider bypass call with mandatory logging and optional retries.
 */
export async function callGatewayBypass(
  messages: Array<{ role: string; content: unknown }>,
  options: BypassOptions
): Promise<BypassResult> {
  const cfg = getModelConfig(options.functionName);
  const requestId = crypto.randomUUID();
  const provider = await getAIProvider();
  let resolved = resolveEndpointWithFallback(provider, cfg, options.functionName);

  const body = buildBypassBody(cfg, messages, options.extraBody);
  // Update model in body to resolved model name
  body.model = resolved.endpoint.modelForApi;
  const timeoutMs = options.timeoutMs ?? 60000;
  const maxRetries = options.maxRetries ?? 0;
  const maxAttempts = maxRetries + (cfg.fallback && !resolved.usedFallback ? 1 : 0);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(resolved.endpoint.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resolved.endpoint.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const latency_ms = Date.now() - t0;

      // Mandatory bypass log
      console.log(JSON.stringify({
        fn: options.functionName,
        model: resolved.modelUsed,
        temperature: cfg.temperature,
        max_tokens: cfg.max_tokens,
        request_id: requestId,
        latency_ms,
        status: response.status,
        attempt,
        bypass_reason: options.bypassReason,
      }));

      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await new Promise(r => setTimeout(r, backoff));
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }

        const errText = await response.text().catch(() => "");
        throw Object.assign(
          new Error(`AI provider error ${response.status}: ${errText.substring(0, 200)}`),
          { status: response.status }
        );
      }

      const data = await response.json();

      return {
        data,
        model_used: resolved.modelUsed,
        latency_ms,
        request_id: requestId,
      };
    } catch (err) {
      clearTimeout(timer);
      
      // If we got an error (other than 429) and we have a fallback, try fallback immediately
      const status = errorStatus(err);
      if (!resolved.usedFallback && cfg.fallback && status !== 429) {
        console.warn(`[gateway-bypass] Primary model ${resolved.modelUsed} failed with ${status}. Trying fallback ${cfg.fallback}`);
        const fallbackProvider = providerForModel(cfg.fallback);
        const fallbackEndpoint = resolveEndpoint(fallbackProvider, cfg.fallback, options.functionName);
        resolved = { endpoint: fallbackEndpoint, modelUsed: cfg.fallback, usedFallback: true };
        body.model = fallbackEndpoint.modelForApi;
        // Continue the loop to retry using the fallback
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }

      if (attempt < maxAttempts && !(err instanceof Error && (err as Error & { status?: number }).status === 402 && !cfg.fallback)) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("[gateway-bypass] Max retries exceeded");
}

/**
 * Execute a streaming provider bypass call. Returns the raw Response
 * so the caller can pipe response.body to the client.
 *
 * Model/temp/tokens are still resolved from MODEL_MAP.
 */
export async function callStreamBypass(
  messages: Array<{ role: string; content: unknown }>,
  options: BypassOptions
): Promise<{ response: Response; model_used: string; request_id: string }> {
  const cfg = getModelConfig(options.functionName);
  const requestId = crypto.randomUUID();
  const provider = await getAIProvider();
  let resolved = resolveEndpointWithFallback(provider, cfg, options.functionName);

  const body = buildBypassBody(cfg, messages, {
    ...options.extraBody,
    stream: true,
  });
  body.model = resolved.endpoint.modelForApi;
  const timeoutMs = options.timeoutMs ?? 60000;

  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response | undefined;
  let fetchFailed = false;
  
  try {
    response = await fetch(resolved.endpoint.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolved.endpoint.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    fetchFailed = true;
    console.warn(`[gateway-bypass] Primary model ${cfg.model} threw network error:`, err);
  }
  
  clearTimeout(timer);
  
  if (!resolved.usedFallback && (fetchFailed || !response?.ok) && cfg.fallback && (!response || response.status !== 429)) {
    console.warn(`[gateway-bypass] Primary model ${resolved.modelUsed} failed. Trying fallback ${cfg.fallback}`);
    const fallbackProvider = providerForModel(cfg.fallback);
    const fallbackEndpoint = resolveEndpoint(fallbackProvider, cfg.fallback, options.functionName);
    resolved = { endpoint: fallbackEndpoint, modelUsed: cfg.fallback, usedFallback: true };
    
    body.model = fallbackEndpoint.modelForApi;
    const fallbackController = new AbortController();
    const fallbackTimer = setTimeout(() => fallbackController.abort(), timeoutMs);
    
    response = await fetch(fallbackEndpoint.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fallbackEndpoint.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: fallbackController.signal,
    });
    clearTimeout(fallbackTimer);
  }

  const latency_ms = Date.now() - t0;

  if (!response) {
    throw new Error("[gateway-bypass] Primary fetch failed and no valid fallback response");
  }

  // Mandatory bypass log
  console.log(JSON.stringify({
    fn: options.functionName,
    model: resolved.modelUsed,
    temperature: cfg.temperature,
    max_tokens: cfg.max_tokens,
    request_id: requestId,
    latency_ms,
    status: response.status,
    bypass_reason: options.bypassReason,
  }));

  return { response, model_used: resolved.modelUsed, request_id: requestId };
}
