const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

const FUNCTIONS_PREFIX = "/functions/v1";

function normalizedSupabaseUrl(): string {
  return SUPABASE_URL.replace(/\/+$/, "");
}

export function getFunctionUrl(functionName: string): string {
  const path = `${FUNCTIONS_PREFIX}/${functionName.replace(/^\/+/, "")}`;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return path;
  }
  return `${normalizedSupabaseUrl()}${path}`;
}

export function rewriteFunctionUrlForDev(input: RequestInfo | URL): RequestInfo | URL {
  if (!import.meta.env.DEV || typeof window === "undefined") return input;

  const base = normalizedSupabaseUrl();
  if (!base) return input;

  const rewrite = (rawUrl: string) => {
    if (!rawUrl.startsWith(`${base}${FUNCTIONS_PREFIX}/`)) return rawUrl;
    const url = new URL(rawUrl);
    return `${url.pathname}${url.search}`;
  };

  if (typeof input === "string") return rewrite(input);
  if (input instanceof URL) return new URL(rewrite(input.toString()), window.location.origin);
  if (input instanceof Request) {
    const rewritten = rewrite(input.url);
    if (rewritten === input.url) return input;
    return new Request(rewritten, input);
  }

  return input;
}
