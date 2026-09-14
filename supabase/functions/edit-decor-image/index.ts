/**
 * edit-decor-image/index.ts
 *
 * Image-to-image editing for the Admin panel.
 * Uploaded image + text instruction → edited image via native Gemini API.
 *
 * Input:  { prompt, image, aspectRatio? }
 *   image: base64 data URI ("data:image/jpeg;base64,...") or public URL
 * Output: { image: "data:image/png;base64,...", model }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CORS_HEADERS,
  geminiNative,
  extractNativeImage,
  okResponse,
  handleError,
  GeminiError,
  errorResponse,
} from "../_shared/gemini.ts";

// Cheap native image model — supports image editing (image + text → image).
const EDIT_IMAGE_MODEL = "gemini-2.5-flash-image";

// Aspect ratios supported by Gemini image generation.
const ASPECT_RATIOS: Record<string, string> = {
  "1:1": "1:1",
  "3:4": "3:4",
  "4:3": "4:3",
  "9:16": "9:16",
  "16:9": "16:9",
};

/** Resolve input image to { mimeType, data } base64. Accepts data URI or URL. */
async function resolveImage(image: string): Promise<{ mimeType: string; data: string }> {
  if (image.startsWith("data:")) {
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new GeminiError("INVALID_IMAGE", "Invalid image data URI");
    return { mimeType: match[1], data: match[2] };
  }
  if (/^https?:\/\//.test(image)) {
    const r = await fetch(image);
    if (!r.ok) throw new GeminiError("INVALID_IMAGE", `Image fetch failed: HTTP ${r.status}`);
    const mime = r.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { mimeType: mime, data: btoa(bin) };
  }
  throw new GeminiError("INVALID_IMAGE", "image must be a data URI or URL");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    let body: any;
    try { body = await req.json(); }
    catch { return errorResponse("INVALID_INPUT", "Invalid JSON body", 400); }

    const { prompt, image, aspectRatio } = body;
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return errorResponse("INVALID_INPUT", "prompt is required (min 3 chars)", 400);
    }
    if (!image || typeof image !== "string") {
      return errorResponse("INVALID_INPUT", "image is required (data URI or URL)", 400);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return errorResponse("MISSING_API_KEY", "GEMINI_API_KEY must be configured", 503);
    }

    const src = await resolveImage(image);

    const generationConfig: Record<string, any> = {
      responseModalities: ["IMAGE", "TEXT"],
    };
    const ar = ASPECT_RATIOS[aspectRatio || ""];
    if (ar) generationConfig.imageConfig = { aspectRatio: ar };

    const data = await geminiNative({
      apiKey: GEMINI_API_KEY,
      model: EDIT_IMAGE_MODEL,
      parts: [
        { text: prompt.trim() },
        { inlineData: { mimeType: src.mimeType, data: src.data } },
      ],
      generationConfig,
      timeoutMs: 70_000,
    });

    const img = extractNativeImage(data);
    if (!img) {
      throw new GeminiError("INVALID_MODEL_RESPONSE", "No image in Gemini response");
    }

    console.log(`[edit-decor-image] ✅ model=${EDIT_IMAGE_MODEL}`);
    return okResponse({
      image: `data:${img.mimeType};base64,${img.data}`,
      model: EDIT_IMAGE_MODEL,
    });
  } catch (e) {
    return handleError("edit-decor-image", e);
  }
});
