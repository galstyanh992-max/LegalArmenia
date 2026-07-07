/**
 * _shared/ai-provider.ts — Resolves the active AI provider setting.
 *
 * Reads `ai_provider` from `app_settings` table.
 * Values: "ollama_cloud" (Ollama Cloud GLM) | "openai" (direct OpenAI API) | "openrouter" (OpenRouter API).
 * Default: auto-detected from configured API keys.
 *
 * Cached per cold-start to avoid repeated DB calls within the same invocation.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AIProvider = "ollama_cloud" | "openai" | "openrouter";

let cachedProvider: AIProvider | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds
const VALID_AI_PROVIDERS = new Set<AIProvider>(["ollama_cloud", "openai", "openrouter"]);

function isAIProvider(value: string | undefined | null): value is AIProvider {
  return !!value && VALID_AI_PROVIDERS.has(value as AIProvider);
}

function detectConfiguredProvider(): AIProvider {
  if (Deno.env.get("OPENROUTER_API_KEY")) return "openrouter";
  if (Deno.env.get("OLLAMA_CLOUD_API_KEY") || Deno.env.get("OLLAMA_API_KEY")) return "ollama_cloud";
  return "openai";
}

/**
 * Functions that MUST always use direct OpenAI (embeddings, enrich workers).
 * These bypass the provider setting entirely.
 */
const OPENAI_ONLY_FUNCTIONS = new Set([
  "generate-embeddings",
  "practice-embed-worker",
]);

/**
 * Check if a function must bypass provider routing and use OpenAI directly.
 */
export function isOpenAIOnlyFunction(functionName: string): boolean {
  return OPENAI_ONLY_FUNCTIONS.has(functionName);
}

/**
 * Get the configured AI provider. Caches for 30s.
 */
export async function getAIProvider(): Promise<AIProvider> {
  const now = Date.now();
  if (cachedProvider && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProvider;
  }

  const envProvider = Deno.env.get("AI_PROVIDER")?.toLowerCase();
  if (isAIProvider(envProvider)) {
    cachedProvider = envProvider;
    cacheTimestamp = now;
    return cachedProvider;
  }
  if (envProvider) {
    console.warn(`[ai-provider] Invalid AI_PROVIDER="${envProvider}", auto-detecting from configured keys`);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      cachedProvider = detectConfiguredProvider();
      console.warn(`[ai-provider] Missing SUPABASE_URL or SERVICE_ROLE_KEY, using ${cachedProvider}`);
      cacheTimestamp = now;
      return cachedProvider;
    }

    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_provider")
      .single();

    if (error || !data) {
      cachedProvider = detectConfiguredProvider();
      console.warn(`[ai-provider] Could not read ai_provider setting, using ${cachedProvider}:`, error?.message);
    } else {
      const val = String(data.value ?? "").toLowerCase();
      if (isAIProvider(val)) {
        cachedProvider = val;
      } else {
        cachedProvider = detectConfiguredProvider();
        console.warn(`[ai-provider] Invalid app_settings.ai_provider="${val}", using ${cachedProvider}`);
      }
    }
  } catch (e) {
    cachedProvider = detectConfiguredProvider();
    console.warn("[ai-provider] Error reading setting:", e);
  }

  cacheTimestamp = now;
  return cachedProvider!;
}

/**
 * Get the endpoint URL and API key for the active provider.
 *
 * Routing rules:
 *   - OpenAI embedding models → always direct OpenAI API
 *   - "openrouter" provider → OpenRouter API
 *   - "openai" provider → direct OpenAI API (strips "openai/" prefix)
 */
export function resolveEndpoint(
  provider: AIProvider,
  modelName: string,
  functionName?: string
): { url: string; apiKey: string; modelForApi: string } {
  // Embedding models always go direct to OpenAI
  if (modelName.startsWith("openai/text-embedding-")) {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("[ai-provider] OPENAI_API_KEY is not configured for embeddings");
    const rawModel = modelName.replace(/^openai\//, "");
    return {
      url: "https://api.openai.com/v1/embeddings",
      apiKey: key,
      modelForApi: rawModel,
    };
  }

  // Ollama Cloud (GLM etc.) — routed by the "ollama/" model prefix, OpenAI-compatible
  // endpoint. Independent of the openai/openrouter setting so GLM-5.2 can be the primary
  // analysis model per-function, with an OpenRouter fallback handled in openai-router.ts.
  if (modelName.startsWith("ollama/")) {
    const key = Deno.env.get("OLLAMA_CLOUD_API_KEY") ?? Deno.env.get("OLLAMA_API_KEY");
    if (!key) throw new Error("[ai-provider] OLLAMA_CLOUD_API_KEY is not configured for Ollama Cloud");
    const base = Deno.env.get("OLLAMA_CLOUD_BASE_URL");
    if (!base) throw new Error("[ai-provider] OLLAMA_CLOUD_BASE_URL is not configured for Ollama Cloud");
    const cleanBase = base.replace(/\/+$/, "");
    return {
      url: `${cleanBase}/chat/completions`,
      apiKey: key,
      modelForApi: modelName.replace(/^ollama\//, ""),
    };
  }

  // Functions that must always use direct OpenAI
  if (functionName && isOpenAIOnlyFunction(functionName)) {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("[ai-provider] OPENAI_API_KEY is not configured for OpenAI-only function");
    const rawModel = modelName.replace(/^openai\//, "");
    return {
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: key,
      modelForApi: rawModel,
    };
  }

  // In Ollama Cloud mode, non-Ollama model IDs are controlled secondary routes
  // through OpenRouter. GLM failure fallback remains controlled in openai-router.ts.
  if (provider === "ollama_cloud") {
    const key = Deno.env.get("OPENROUTER_API_KEY");
    if (!key) throw new Error("[ai-provider] OPENROUTER_API_KEY is not configured for secondary OpenRouter model route");
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: key,
      modelForApi: modelName,
    };
  }

  // OpenRouter provider: route ALL models (including google/*) through OpenRouter
  if (provider === "openrouter") {
    const key = Deno.env.get("OPENROUTER_API_KEY");
    if (!key) throw new Error("[ai-provider] OPENROUTER_API_KEY is not configured for OpenRouter mode");
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: key,
      modelForApi: modelName, // OpenRouter accepts provider-qualified model names.
    };
  }

  // Direct OpenAI provider
  if (provider === "openai" && modelName.startsWith("openai/")) {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("[ai-provider] OPENAI_API_KEY is not configured for direct OpenAI mode");
    const rawModel = modelName.replace(/^openai\//, "");
    return {
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: key,
      modelForApi: rawModel,
    };
  }

  throw new Error(
    `[ai-provider] ${functionName ?? "unknown function"} model "${modelName}" is not compatible with AI_PROVIDER=openai. ` +
      `Set AI_PROVIDER=openrouter or configure this function with an openai/* model.`
  );
}
