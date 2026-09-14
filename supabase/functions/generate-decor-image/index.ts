/**
 * generate-decor-image/index.ts
 *
 * Single decor image generator for the Admin panel.
 * Uses native Google Gemini API with a cheap image model (gemini-2.5-flash-image).
 *
 * Input:  { prompt, aspectRatio? }
 * Output: { image: "data:image/png;base64,...", model }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CORS_HEADERS,
  aiImageGen,
  extractGatewayImage,
  extractNativeImage,
  geminiNative,
  okResponse,
  handleError,
  GeminiError,
  errorResponse,
} from "../_shared/gemini.ts";

// Cheap native image model — one of the most affordable Gemini image models.
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";

// Aspect ratios supported by Gemini image generation.
const ASPECT_RATIOS: Record<string, string> = {
  "1:1": "1:1",
  "3:4": "3:4",
  "4:3": "4:3",
  "9:16": "9:16",
  "16:9": "16:9",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    let body: any;
    try { body = await req.json(); }
    catch { return errorResponse("INVALID_INPUT", "Invalid JSON body", 400); }

    const { prompt, aspectRatio } = body;
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return errorResponse("INVALID_INPUT", "prompt is required (min 3 chars)", 400);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!GEMINI_API_KEY && !LOVABLE_API_KEY) {
      return errorResponse("MISSING_API_KEY", "GEMINI_API_KEY or LOVABLE_API_KEY must be configured", 503);
    }

    const ar = ASPECT_RATIOS[aspectRatio || ""];

    // ── Path 1: native Gemini (cheap image model) ───────────────────────────
    if (GEMINI_API_KEY) {
      const generationConfig: Record<string, any> = {
        responseModalities: ["IMAGE", "TEXT"],
      };
      if (ar) generationConfig.imageConfig = { aspectRatio: ar };

      const data = await geminiNative({
        apiKey: GEMINI_API_KEY,
        model: DEFAULT_IMAGE_MODEL,
        parts: [{ text: prompt.trim() }],
        generationConfig,
        timeoutMs: 70_000,
      });

      const img = extractNativeImage(data);
      if (!img) {
        throw new GeminiError("INVALID_MODEL_RESPONSE", "No image in Gemini response");
      }

      console.log(`[generate-decor-image] ✅ native model=${DEFAULT_IMAGE_MODEL}`);
      return okResponse({
        image: `data:${img.mimeType};base64,${img.data}`,
        model: DEFAULT_IMAGE_MODEL,
      });
    }

    // ── Path 2: fallback to Lovable AI Gateway ─────────────────────────────
    console.log("[generate-decor-image] GEMINI_API_KEY missing — falling back to Lovable Gateway");
    const gatewayData = await aiImageGen({
      apiKey: LOVABLE_API_KEY!,
      messages: [{ role: "user", content: [{ type: "text", text: prompt.trim() }] }],
      timeoutMs: 60_000,
    });

    const image = extractGatewayImage(gatewayData);
    if (!image) {
      throw new GeminiError("INVALID_MODEL_RESPONSE", "No image in gateway response");
    }

    return okResponse({ image, model: "lovable-gateway" });
  } catch (e) {
    return handleError("generate-decor-image", e);
  }
});
