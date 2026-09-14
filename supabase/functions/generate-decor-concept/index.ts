/**
 * generate-decor-concept/index.ts  (v3 — Lovable AI Gateway)
 * Generates luxury decoration concepts with AI-generated inspiration images.
 * Models: gemini-2.5-pro (concept) + gemini-2.5-flash-image (visuals).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CORS_HEADERS, AI_MODELS, requireApiKeyAsync, aiChat, aiGenerateImage,
  extractToolCall, fetchImageAsBase64,
  okResponse, handleError, GeminiError, errorResponse,
} from "../_shared/gemini.ts";

function buildImagePrompt(concept: any, keyword: string): string {
  const colors = (concept.colorPalette || []).slice(0, 3).join(", ");
  const style = concept.conceptName || "luxury event";
  return [
    `Luxury event decoration photography, professional editorial style.`,
    `Theme: "${style}". Color palette: ${colors}.`,
    `Focus: ${keyword}.`,
    `Elegant, sophisticated, high-end event decor.`,
    `Warm golden ambient lighting. No text, no watermarks, no people. Photorealistic.`,
  ].join(" ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    let body: any;
    try { body = await req.json(); } catch {
      return errorResponse("INVALID_INPUT", "Request body must be valid JSON", 400);
    }

    const { eventType, venueType, colorPalette, guestCount, decorStyle, venuePhotoUrl, textDescription } = body;
    
    // Allow generation either from structured fields OR from text description
    const hasStructured = eventType && venueType && colorPalette && guestCount;
    const hasDescription = textDescription && textDescription.trim().length >= 10;
    
    if (!hasStructured && !hasDescription) {
      return errorResponse("INVALID_INPUT", "Required: eventType, venueType, colorPalette, guestCount OR textDescription (min 10 chars)", 400);
    }

    const API_KEY = await requireApiKeyAsync();
    console.log(`[generate-decor-concept] reasoning=${AI_MODELS.REASONING} img=${AI_MODELS.IMAGE_GEN}`);

    // Optional: fetch venue photo
    let venueImageContent: any = null;
    if (venuePhotoUrl) {
      try {
        const img = await fetchImageAsBase64(venuePhotoUrl);
        venueImageContent = { type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } };
      } catch (e) {
        console.warn("[generate-decor-concept] Could not load venue photo:", e);
      }
    }

    const contextParts: string[] = [];
    if (eventType) contextParts.push(`Event: ${eventType}`);
    if (venueType) contextParts.push(`Venue: ${venueType}`);
    if (guestCount) contextParts.push(`Guests: ${guestCount}`);
    if (decorStyle) contextParts.push(`Style: ${decorStyle}`);
    if (colorPalette) contextParts.push(`Colors: ${colorPalette}`);
    
    const systemPrompt = `You are KiKi Decor Studio's creative director — a luxury event decoration company. Respond ONLY with the generate_concept tool call. All output text in Russian.

${contextParts.length > 0 ? contextParts.join(" | ") : ""}
${textDescription ? `\nClient's vision: "${textDescription}"` : ""}
${venueImageContent ? "\nA venue photo is attached. Analyze the space and tailor every recommendation specifically to what you see." : ""}

Think like a creative director presenting a full mood board concept to an affluent client. Be specific about materials, textures, flowers, and placement. Consider seasonality, logistics, and guest flow.`;

    const userText = textDescription
      ? `Generate a complete luxury decoration concept based on the client's description: "${textDescription}"` + (venueImageContent ? " Also analyze the venue photo." : "")
      : "Generate a complete luxury decoration concept." + (venueImageContent ? " Analyze the venue photo." : "");

    const userContent: any[] = [{ type: "text", text: userText }];
    if (venueImageContent) userContent.push(venueImageContent);

    // Step 1: Generate concept with REASONING model
    const chatData = await aiChat({
      apiKey: API_KEY,
      model: AI_MODELS.FAST,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_concept",
          description: "Return a structured luxury decoration concept",
          parameters: {
            type: "object",
            properties: {
              conceptName: { type: "string", description: "Beautiful poetic concept name (Russian)" },
              conceptDescription: { type: "string", description: "3-4 sentences about atmosphere and guest experience" },
              colorPalette: { type: "array", items: { type: "string" }, description: "5 color names in Russian" },
              colorHexCodes: { type: "array", items: { type: "string" }, description: "5 HEX codes" },
              decorElements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string", enum: ["focal", "table", "ambient", "entrance", "ceiling", "wall", "floor"] },
                    estimated_cost: { type: "string" },
                  },
                  required: ["name", "description", "category"],
                },
              },
              flowerArrangements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    flowers: { type: "array", items: { type: "string" } },
                    placement: { type: "string" },
                    style: { type: "string" },
                  },
                  required: ["name", "flowers", "placement", "style"],
                },
              },
              lightingIdeas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    element: { type: "string" },
                    placement: { type: "string" },
                    effect: { type: "string" },
                  },
                  required: ["element", "placement", "effect"],
                },
              },
              backdropIdeas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    purpose: { type: "string", enum: ["photo_zone", "stage_backdrop", "entrance", "head_table"] },
                  },
                  required: ["name", "description", "purpose"],
                },
              },
              tableDecoration: {
                type: "object",
                properties: {
                  style: { type: "string" },
                  centerpiece: { type: "string" },
                  tableware: { type: "string" },
                  accents: { type: "string" },
                  runner: { type: "string" },
                },
                required: ["style", "centerpiece", "tableware", "accents"],
              },
              estimatedComplexity: { type: "string", enum: ["low", "medium", "high", "ultra"] },
              estimatedBudget: { type: "string" },
              venueSpecificNotes: { type: "string" },
              inspirationKeywords: {
                type: "array",
                items: { type: "string" },
                description: "3-4 English keywords for image generation",
              },
            },
            required: [
              "conceptName", "conceptDescription", "colorPalette", "colorHexCodes",
              "decorElements", "flowerArrangements", "lightingIdeas", "backdropIdeas",
              "tableDecoration", "estimatedComplexity", "inspirationKeywords",
            ],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "generate_concept" } },
      timeoutMs: 50_000,
    });

    const concept = extractToolCall(chatData);
    if (!concept?.conceptName || !concept?.decorElements) {
      throw new GeminiError("INVALID_MODEL_RESPONSE", "AI returned unexpected format");
    }

    console.log(`[generate-decor-concept] ✅ Concept: "${concept.conceptName}" | generating images...`);

    // Step 2: Generate 3 inspiration images in parallel
    const keywords: string[] = (concept.inspirationKeywords || []).slice(0, 3);

    const imagePromises = keywords.map(async (keyword: string, idx: number) => {
      const prompt = buildImagePrompt(concept, keyword);

      // First image with venue context if available
      if (idx === 0 && venuePhotoUrl) {
        try {
          const img = await fetchImageAsBase64(venuePhotoUrl);
          const contextUrl = `data:${img.mimeType};base64,${img.data}`;
          return await aiGenerateImage({
            apiKey: API_KEY,
            prompt: `${prompt} The decoration is installed in this specific venue space.`,
            contextImageUrl: contextUrl,
            timeoutMs: 55_000,
          });
        } catch (e) {
          console.warn(`[generate-decor-concept] Image with venue context failed:`, e);
        }
      }

      return await aiGenerateImage({
        apiKey: API_KEY,
        prompt,
        timeoutMs: 55_000,
      });
    });

    const images = await Promise.all(imagePromises);
    concept.inspirationImages = images.filter(Boolean);

    console.log(`[generate-decor-concept] 🎨 Images: ${concept.inspirationImages.length}/${keywords.length}`);
    return okResponse(concept);

  } catch (e) {
    return handleError("generate-decor-concept", e);
  }
});
