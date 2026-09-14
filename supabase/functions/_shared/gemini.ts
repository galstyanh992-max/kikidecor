/**
 * _shared/gemini.ts  (v4 — Multi-provider AI layer)
 *
 * Routes AI calls through the active provider configured in `ai_provider_settings`.
 * Default = Lovable AI Gateway. Falls back to Lovable if any error occurs reading config.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ProviderId = "lovable" | "openai" | "gemini" | "anthropic";

interface ProviderConfig {
  provider: ProviderId;
  baseUrl: string;
  apiKey: string;
  apiKeyEnvName: string;
  models: { reasoning: string; fast: string; vision: string; image: string };
  supportsImageGen: boolean;
}

const DEFAULTS_BY_PROVIDER: Record<ProviderId, { baseUrl: string; envName: string; models: ProviderConfig["models"]; supportsImageGen: boolean }> = {
  lovable: {
    baseUrl: LOVABLE_GATEWAY,
    envName: "LOVABLE_API_KEY",
    models: {
      reasoning: "google/gemini-3.1-pro-preview",
      fast: "google/gemini-3-flash-preview",
      vision: "google/gemini-2.5-flash",
      image: "google/gemini-3.1-flash-image",
    },
    supportsImageGen: true,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    envName: "OPENAI_API_KEY",
    models: { reasoning: "gpt-5", fast: "gpt-5-mini", vision: "gpt-5-mini", image: "" },
    supportsImageGen: false,
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    envName: "GEMINI_API_KEY",
    models: {
      reasoning: "gemini-2.5-pro",
      fast: "gemini-2.5-flash",
      vision: "gemini-2.5-flash",
      image: "gemini-3.1-flash-image",
    },
    supportsImageGen: true,
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1/chat/completions",
    envName: "ANTHROPIC_API_KEY",
    models: { reasoning: "claude-opus-4", fast: "claude-sonnet-4", vision: "claude-sonnet-4", image: "" },
    supportsImageGen: false,
  },
};

let _cachedConfig: ProviderConfig | null = null;
let _cacheExpiresAt = 0;
const CONFIG_TTL_MS = 30_000;

async function loadActiveConfig(): Promise<ProviderConfig> {
  const now = Date.now();
  if (_cachedConfig && now < _cacheExpiresAt) return _cachedConfig;

  let provider: ProviderId = "lovable";
  let custom: { reasoning?: string; fast?: string; vision?: string; image?: string } = {};

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) {
      const sb = createClient(url, key);
      const { data } = await sb
        .from("ai_provider_settings")
        .select("provider, model_reasoning, model_fast, model_vision, model_image")
        .eq("is_active", true)
        .maybeSingle();
      if (data?.provider) {
        provider = data.provider as ProviderId;
        custom = {
          reasoning: data.model_reasoning ?? undefined,
          fast: data.model_fast ?? undefined,
          vision: data.model_vision ?? undefined,
          image: data.model_image ?? undefined,
        };
      }
    }
  } catch (e) {
    console.warn("[ai:config] Failed to read ai_provider_settings, falling back to Lovable:", e);
  }

  const def = DEFAULTS_BY_PROVIDER[provider];
  const apiKey = Deno.env.get(def.envName);
  if (!apiKey) {
    if (provider !== "lovable") {
      console.warn(`[ai:config] ${def.envName} missing for provider ${provider}; falling back to Lovable`);
      const fallback = DEFAULTS_BY_PROVIDER.lovable;
      const fbKey = Deno.env.get(fallback.envName);
      if (!fbKey) throw new GeminiError("MISSING_API_KEY", "AI service is not configured");
      _cachedConfig = {
        provider: "lovable", baseUrl: fallback.baseUrl, apiKey: fbKey, apiKeyEnvName: fallback.envName,
        models: fallback.models, supportsImageGen: true,
      };
      _cacheExpiresAt = now + CONFIG_TTL_MS;
      return _cachedConfig;
    }
    throw new GeminiError("MISSING_API_KEY", "AI service is not configured");
  }

  _cachedConfig = {
    provider,
    baseUrl: def.baseUrl,
    apiKey,
    apiKeyEnvName: def.envName,
    models: {
      reasoning: custom.reasoning || def.models.reasoning,
      fast: custom.fast || def.models.fast,
      vision: custom.vision || def.models.vision,
      image: custom.image || def.models.image,
    },
    supportsImageGen: def.supportsImageGen,
  };
  _cacheExpiresAt = now + CONFIG_TTL_MS;
  return _cachedConfig;
}

/** Force config reload on next call. */
export function invalidateAIConfigCache() { _cachedConfig = null; _cacheExpiresAt = 0; }

/** Get current active AI configuration (provider, models, gateway URL). */
export async function getAIConfig(): Promise<ProviderConfig> { return loadActiveConfig(); }

/**
 * AI_MODELS is a Proxy that returns model names from the currently active provider.
 * Reads are synchronous — they use the last cached config or provider defaults.
 * For first-call correctness, edge functions should call `await getAIConfig()` once on startup.
 */
export const AI_MODELS = new Proxy(
  {} as { REASONING: string; FAST: string; VISION: string; IMAGE_GEN: string },
  {
    get(_t, prop: string) {
      const cfg = _cachedConfig ?? {
        models: DEFAULTS_BY_PROVIDER.lovable.models,
      } as Partial<ProviderConfig>;
      const m = cfg.models!;
      switch (prop) {
        case "REASONING": return m.reasoning;
        case "FAST": return m.fast;
        case "VISION": return m.vision;
        case "IMAGE_GEN": return m.image;
      }
      return undefined;
    },
  }
);

// ─── CORS ────────────────────────────────────────────────────────────────────

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Error handling ──────────────────────────────────────────────────────────

export type AIErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_INPUT"
  | "INVALID_IMAGE"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "PAYMENT_REQUIRED"
  | "INVALID_MODEL_RESPONSE"
  | "PROVIDER_REQUEST_FAILED"
  | "JSON_PARSE_FAILED";

/** @deprecated Use AIErrorCode. Kept for backward compatibility. */
export type GeminiErrorCode = AIErrorCode;

export class GeminiError extends Error {
  constructor(public code: AIErrorCode, message: string) {
    super(message);
    this.name = "GeminiError";
  }
}

// ─── API key ─────────────────────────────────────────────────────────────────

/**
 * Returns API key for the currently active provider.
 * Side effect: warms up the config cache so AI_MODELS proxy returns provider-specific models.
 */
export function requireApiKey(): string {
  // Best-effort sync wrapper. If cache is cold, kick off async load (next call will use it).
  if (_cachedConfig) return _cachedConfig.apiKey;
  const lovKey = Deno.env.get("LOVABLE_API_KEY");
  // Fire-and-forget warm-up
  loadActiveConfig().catch(() => {});
  if (!lovKey) {
    throw new GeminiError("MISSING_API_KEY", "AI service is not configured");
  }
  return lovKey;
}

/** Async version: always returns the active provider's API key after loading config. */
export async function requireApiKeyAsync(): Promise<string> {
  const cfg = await loadActiveConfig();
  return cfg.apiKey;
}

// ─── JSON helpers ────────────────────────────────────────────────────────────

export function safeParseJson<T = any>(raw: string): T | null {
  try {
    return JSON.parse(
      raw.replace(/^```json\s*/gm, "").replace(/^```\s*/gm, "").trim()
    ) as T;
  } catch {
    return null;
  }
}

export function extractToolCall<T = any>(data: any): T | null {
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) return safeParseJson<T>(toolCall.function.arguments);
  const content = data?.choices?.[0]?.message?.content;
  if (content) return safeParseJson<T>(content);
  return null;
}

/** Extract first image from Lovable Gateway image generation response */
export function extractGatewayImage(data: any): string | null {
  const images = data?.choices?.[0]?.message?.images;
  if (images?.[0]?.image_url?.url) return images[0].image_url.url;
  return null;
}

/** Parse base64 data and mimeType from a data URI */
export function parseDataUri(dataUri: string): { data: string; mimeType: string } | null {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

// ─── Network ─────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─── Retry logic ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const nonRetryable = e instanceof GeminiError &&
        ["INVALID_INPUT", "MISSING_API_KEY", "PAYMENT_REQUIRED", "INVALID_IMAGE"].includes(e.code);
      if (nonRetryable) throw e;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`[ai:retry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ─── Response helpers ────────────────────────────────────────────────────────

export function errorResponse(code: AIErrorCode, message: string, status = 500): Response {
  return new Response(
    JSON.stringify({ success: false, error: code, message }),
    { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
}

export function okResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── aiChat — text/tool_call/vision via Lovable Gateway ──────────────────────

export interface AIChatOptions {
  apiKey: string;
  model?: string;
  messages: any[];
  tools?: any[];
  tool_choice?: any;
  timeoutMs?: number;
  maxRetries?: number;
}

export async function aiChat(opts: AIChatOptions): Promise<any> {
  const cfg = await loadActiveConfig();
  const model = opts.model ?? cfg.models.fast;
  console.log(`[ai:chat] provider=${cfg.provider} model=${model} msgs=${opts.messages.length}`);

  return withRetry(async () => {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        cfg.baseUrl,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: opts.messages,
            ...(opts.tools ? { tools: opts.tools } : {}),
            ...(opts.tool_choice ? { tool_choice: opts.tool_choice } : {}),
          }),
        },
        opts.timeoutMs ?? 45_000
      );
    } catch (e: any) {
      if (e?.name === "AbortError") throw new GeminiError("TIMEOUT", "AI request timed out");
      throw new GeminiError("PROVIDER_REQUEST_FAILED", `${cfg.provider} gateway unreachable: ${e?.message}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[ai:chat] provider=${cfg.provider} HTTP ${response.status}:`, body.slice(0, 300));
      if (response.status === 429) throw new GeminiError("RATE_LIMIT", "Rate limit exceeded. Try again later.");
      if (response.status === 402) throw new GeminiError("PAYMENT_REQUIRED", "AI credits exhausted.");
      throw new GeminiError("PROVIDER_REQUEST_FAILED", `AI provider error ${response.status}`);
    }

    const data = await response.json();
    console.log(`[ai:chat] ✅ provider=${cfg.provider} model=${model}`);
    return data;
  }, opts.maxRetries ?? 2);
}

// ─── aiImageGen — image generation via Lovable Gateway ───────────────────────

export interface AIImageGenOptions {
  apiKey: string;
  messages: any[];
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export async function aiImageGen(opts: AIImageGenOptions): Promise<any> {
  const activeCfg = await loadActiveConfig();
  // Image generation requires Lovable or Gemini; fall back to Lovable otherwise.
  const cfg = activeCfg.supportsImageGen
    ? activeCfg
    : await (async () => {
        const lovKey = Deno.env.get("LOVABLE_API_KEY");
        if (!lovKey) throw new GeminiError("MISSING_API_KEY", "Image generation requires Lovable Gateway (LOVABLE_API_KEY missing)");
        console.warn(`[ai:image-gen] provider ${activeCfg.provider} does not support image gen, falling back to Lovable`);
        return { ...DEFAULTS_BY_PROVIDER.lovable, provider: "lovable" as ProviderId, apiKey: lovKey, apiKeyEnvName: "LOVABLE_API_KEY", supportsImageGen: true };
      })();

  const model = opts.model ?? cfg.models.image;
  console.log(`[ai:image-gen] provider=${cfg.provider} model=${model}`);

  return withRetry(async () => {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        cfg.baseUrl,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: opts.messages,
            modalities: ["image", "text"],
          }),
        },
        opts.timeoutMs ?? 60_000
      );
    } catch (e: any) {
      if (e?.name === "AbortError") throw new GeminiError("TIMEOUT", "Image generation timed out");
      throw new GeminiError("PROVIDER_REQUEST_FAILED", `${cfg.provider} unreachable: ${e?.message}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[ai:image-gen] HTTP ${response.status}:`, body.slice(0, 300));
      if (response.status === 429) throw new GeminiError("RATE_LIMIT", "Rate limit exceeded");
      if (response.status === 402) throw new GeminiError("PAYMENT_REQUIRED", "AI credits exhausted");
      throw new GeminiError("PROVIDER_REQUEST_FAILED", `Image gen error ${response.status}`);
    }

    return await response.json();
  }, opts.maxRetries ?? 1);
}

// ─── Convenience: generate a single image from prompt ────────────────────────

export async function aiGenerateImage(opts: {
  apiKey: string;
  prompt: string;
  contextImageUrl?: string;
  timeoutMs?: number;
}): Promise<string | null> {
  const content: any[] = [{ type: "text", text: opts.prompt }];
  if (opts.contextImageUrl) {
    content.push({ type: "image_url", image_url: { url: opts.contextImageUrl } });
  }

  try {
    const data = await aiImageGen({
      apiKey: opts.apiKey,
      messages: [{ role: "user", content }],
      timeoutMs: opts.timeoutMs ?? 50_000,
    });
    return extractGatewayImage(data);
  } catch (e) {
    console.warn("[ai:generate-image] Failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ─── Native Gemini API (generateContent) ─────────────────────────────────────
// Direct calls to Google AI Studio (generativelanguage.googleapis.com).
// Used for native image generation with cheap models like gemini-2.5-flash-image.

const GEMINI_NATIVE_HOST = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiNativeOptions {
  apiKey: string;
  model: string;
  parts: any[];
  generationConfig?: Record<string, any>;
  timeoutMs?: number;
}

export async function geminiNative(opts: GeminiNativeOptions): Promise<any> {
  const url = `${GEMINI_NATIVE_HOST}/models/${opts.model}:generateContent?key=${opts.apiKey}`;
  console.log(`[ai:gemini-native] model=${opts.model}`);

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: opts.parts }],
        ...(opts.generationConfig ? { generationConfig: opts.generationConfig } : {}),
      }),
    },
    opts.timeoutMs ?? 60_000
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[ai:gemini-native] HTTP ${response.status}:`, body.slice(0, 400));
    if (response.status === 429) throw new GeminiError("RATE_LIMIT", "Rate limit exceeded");
    if (response.status === 403) throw new GeminiError("MISSING_API_KEY", "Gemini API key invalid or disabled");
    throw new GeminiError("PROVIDER_REQUEST_FAILED", `Gemini native error ${response.status}`);
  }

  return await response.json();
}

/** Extract the first inline image (base64) from a native Gemini generateContent response. */
export function extractNativeImage(data: any): { mimeType: string; data: string } | null {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (part?.inlineData?.data) {
      return { mimeType: part.inlineData.mimeType || "image/png", data: part.inlineData.data };
    }
  }
  return null;
}

// ─── Image fetch utility ─────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  console.log("[ai] Fetching image:", url.slice(0, 60));
  let resp: Response;
  try {
    resp = await fetchWithTimeout(url, {}, 15_000);
  } catch (e: any) {
    throw new GeminiError("INVALID_IMAGE", `Cannot fetch image: ${e?.message}`);
  }

  if (!resp.ok) throw new GeminiError("INVALID_IMAGE", `Image fetch failed: HTTP ${resp.status}`);

  const contentType = resp.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
  const mimeType = ALLOWED_MIME_TYPES.includes(contentType) ? contentType : "image/jpeg";

  const buffer = await resp.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new GeminiError("INVALID_IMAGE", "Image exceeds 10 MB");

  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { data: btoa(binary), mimeType };
}

// ─── Error handler ───────────────────────────────────────────────────────────

export function handleError(fn: string, e: unknown): Response {
  console.error(`[${fn}] Error:`, e instanceof Error ? e.message : String(e));

  if (e instanceof GeminiError) {
    const statusMap: Record<AIErrorCode, number> = {
      MISSING_API_KEY: 503,
      INVALID_INPUT: 400,
      INVALID_IMAGE: 400,
      TIMEOUT: 504,
      RATE_LIMIT: 429,
      PAYMENT_REQUIRED: 402,
      INVALID_MODEL_RESPONSE: 502,
      PROVIDER_REQUEST_FAILED: 502,
      JSON_PARSE_FAILED: 502,
    };
    return errorResponse(e.code, e.message, statusMap[e.code] ?? 500);
  }

  return errorResponse("PROVIDER_REQUEST_FAILED", "An unexpected error occurred. Please try again.", 500);
}

// ─── Backward compatibility aliases ──────────────────────────────────────────
// These map old function names to new ones for any code not yet migrated.

/** @deprecated Use AI_MODELS.VISION */
export function getTextModel(): string { return AI_MODELS.VISION; }
/** @deprecated Use AI_MODELS.IMAGE_GEN */
export const IMAGE_GEN_MODEL = AI_MODELS.IMAGE_GEN;
/** @deprecated Use aiChat */
export const geminiChat = aiChat;
/** @deprecated Use extractGatewayImage + parseDataUri */
export function extractNativeText(data: any): string | null {
  return data?.choices?.[0]?.message?.content ?? null;
}
