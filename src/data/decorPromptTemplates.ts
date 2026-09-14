// 20 готовых шаблонов промтов для генерации изображений декора и
// 20 шаблонов для генерации видео декора (Google Gemini / Veo).
// Промты на английском — генеративные модели работают с ними стабильнее.

export type DecorPromptTemplate = {
  id: string;
  name: string;
  prompt: string;
};

export const IMAGE_PROMPT_TEMPLATES: DecorPromptTemplate[] = [
  {
    id: "wedding-arch",
    name: "Свадебная арка",
    prompt:
      "Luxurious wedding ceremony arch with cascading white roses, hydrangeas and eucalyptus, champagne gold candle holders on both sides, flowing ivory draping, elegant ballroom, warm golden ambient lighting. Professional event decoration photography, editorial style, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "head-table",
    name: "Стол президиума",
    prompt:
      "Premium wedding head table centerpiece with lush low floral runner of blush roses and peonies, crystal candelabras, gold-rimmed tableware, satin blush tablecloth, soft bokeh fairy lights in background. Luxury event decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "floral-wall",
    name: "Цветочная стена",
    prompt:
      "Full floral wall installation of mixed pastel flowers — roses, carnations, baby's breath — in a geometric grid, soft studio lighting, high-end event backdrop, clean luxury aesthetic. Professional decor photography, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "ceiling-installation",
    name: "Потолочная инсталляция",
    prompt:
      "Hanging ceiling floral installation with wisteria and orchids suspended above a round banquet table, warm candlelight, elegant restaurant interior, dramatic yet soft light. Luxury event decoration photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "outdoor-ceremony",
    name: "Церемония на природе",
    prompt:
      "Outdoor garden wedding ceremony setup with white floral aisle, wooden cross-back chairs, string lights, lush greenery and golden hour sunlight. Elegant luxury outdoor decor, professional photography, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "candlelit-romance",
    name: "Свечная романтика",
    prompt:
      "Romantic candlelit dinner table decor with dozens of taper candles in brass holders, dark moody palette, deep burgundy florals, crystal glassware, intimate luxury atmosphere. Editorial event decor photography, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "boho-chic",
    name: "Бохо-шик",
    prompt:
      "Boho chic event decor with pampas grass, dried florals, macrame, rattan chairs, neutral beige palette, soft natural light, relaxed luxury outdoor lounge. Professional event decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "art-deco-glam",
    name: "Арт-деко гламур",
    prompt:
      "Art deco glam event styling with black and gold geometric backdrop, mirrored accents, emerald velvet, feather centerpieces, dramatic spotlights. Luxury ballroom decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "tropical-paradise",
    name: "Тропический рай",
    prompt:
      "Tropical luxury event decor with monstera leaves, palm fronds, white orchids, rattan lanterns, bright airy setting with natural sunlight. High-end resort decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "winter-wonderland",
    name: "Зимняя сказка",
    prompt:
      "Winter wonderland event decor with frosted white branches, crystal icicle details, silver and icy blue palette, soft sparkling lights, snow-like textures. Luxury winter event photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "rustic-elegance",
    name: "Рустик",
    prompt:
      "Rustic elegant barn wedding decor with wooden farm tables, linen runners, eucalyptus garland, mason jar candles, warm string lights, natural wood tones. Professional event decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "minimal-premium",
    name: "Минимализм премиум",
    prompt:
      "Minimalist premium event decor with white plaster walls, single sculptural floral arrangement, clean lines, generous negative space, soft diffused daylight. Luxury minimal decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "jewel-tone-luxe",
    name: "Драгоценные тона",
    prompt:
      "Jewel tone luxury table setting with emerald, sapphire and amethyst accents, gold cutlery, velvet linens, dramatic candlelight, opulent dark atmosphere. Editorial event decor photography, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "neon-photo-zone",
    name: "Неоновая фотозона",
    prompt:
      "Stylish neon photo zone for a modern event with glowing pink and violet neon sign, acrylic panels, glossy floor reflections, urban chic atmosphere. Professional event decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "green-wall",
    name: "Зелёная стена",
    prompt:
      "Lush green living wall with boxwood and ivy, white floral accents, elegant event entrance backdrop, soft warm uplighting, premium botanical styling. Luxury event decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "coastal-breeze",
    name: "Морской бриз",
    prompt:
      "Coastal luxury event decor with white and sand palette, driftwood accents, sea glass details, airy linen drapery, light ocean breeze atmosphere. High-end seaside decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "provence-lavender",
    name: "Прованс",
    prompt:
      "Provence style event decor with lavender bouquets, soft cream and purple palette, vintage wooden furniture, lace details, warm summer light. Romantic French country decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "oriental-luxury",
    name: "Восточная роскошь",
    prompt:
      "Oriental luxury event decor with gold lanterns, rich burgundy and gold fabrics, carved details, low seating with plush cushions, warm ambient lighting. Opulent eastern decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "modern-luxury-lounge",
    name: "Современный люкс лаунж",
    prompt:
      "Modern luxury lounge decor with velvet sofas, marble coffee tables, sculptural floral arrangements, brushed brass accents, soft ambient lighting, contemporary hotel atmosphere. Editorial event decor photography, photorealistic, no text, no watermarks, no people.",
  },
  {
    id: "luxury-centerpiece",
    name: "Цветочный центр стола",
    prompt:
      "Luxury table centerpiece with tall crystal vase, white phalaenopsis orchids, cascading greenery, gold candle holders, polished table setting, elegant restaurant background. Professional event decor photography, editorial, photorealistic, no text, no watermarks, no people.",
  },
];

export const VIDEO_PROMPT_TEMPLATES: DecorPromptTemplate[] = [
  {
    id: "wedding-arch",
    name: "Свадебная арка",
    prompt:
      "Slow cinematic dolly-in towards a luxurious wedding arch with cascading white roses and soft golden candlelight, gentle movement of sheer drapery, warm romantic atmosphere.",
  },
  {
    id: "head-table",
    name: "Стол президиума",
    prompt:
      "Elegant slow pan across a premium wedding head table with blush floral runner, crystal candelabras and gold tableware, soft fairy lights glowing in the background.",
  },
  {
    id: "floral-wall",
    name: "Цветочная стена",
    prompt:
      "Gradual tilt-up revealing a full pastel floral wall installation, petals subtly swaying, soft studio lighting, high-end event backdrop.",
  },
  {
    id: "ceiling-installation",
    name: "Потолочная инсталляция",
    prompt:
      "Gentle orbit around a hanging ceiling floral installation above a round banquet table, warm candlelight flickering, wisteria gently moving, luxury restaurant ambiance.",
  },
  {
    id: "outdoor-ceremony",
    name: "Церемония на природе",
    prompt:
      "Slow crane-down over an outdoor garden wedding ceremony with white floral aisle and string lights, golden hour sunlight, lush greenery swaying softly.",
  },
  {
    id: "candlelit-romance",
    name: "Свечная романтика",
    prompt:
      "Intimate slow pan over a candlelit dinner table with dozens of flickering taper candles, deep burgundy florals and crystal glassware, moody romantic light.",
  },
  {
    id: "boho-chic",
    name: "Бохо-шик",
    prompt:
      "Relaxed slow dolly-out from a boho chic lounge with pampas grass and macrame, neutral beige palette, soft natural light and gentle breeze moving the dried florals.",
  },
  {
    id: "art-deco-glam",
    name: "Арт-деко гламур",
    prompt:
      "Dramatic slow pan across an art deco glam event setup with black and gold geometric backdrop, mirrored accents and feather centerpieces under shifting spotlights.",
  },
  {
    id: "tropical-paradise",
    name: "Тропический рай",
    prompt:
      "Bright slow pan over tropical luxury decor with monstera leaves, palm fronds and white orchids, sunbeams filtering through, airy resort atmosphere.",
  },
  {
    id: "winter-wonderland",
    name: "Зимняя сказка",
    prompt:
      "Magical slow dolly-in through a winter wonderland decor with frosted white branches and crystal icicles, sparkling silver lights, soft snow-like textures.",
  },
  {
    id: "rustic-elegance",
    name: "Рустик",
    prompt:
      "Warm slow pan along a rustic barn table with wooden farm tables, eucalyptus garland and mason jar candles, string lights twinkling, cozy natural atmosphere.",
  },
  {
    id: "minimal-premium",
    name: "Минимализм премиум",
    prompt:
      "Quiet slow tilt-up over minimalist premium decor with white plaster walls and a single sculptural floral arrangement, soft diffused daylight, serene calm mood.",
  },
  {
    id: "jewel-tone-luxe",
    name: "Драгоценные тона",
    prompt:
      "Opulent slow orbit around a jewel tone luxury table with emerald and sapphire accents, gold cutlery and velvet linens, dramatic candlelight flickering.",
  },
  {
    id: "neon-photo-zone",
    name: "Неоновая фотозона",
    prompt:
      "Stylish slow dolly-in towards a neon photo zone with glowing pink and violet neon, acrylic panels and glossy floor reflections, modern urban energy.",
  },
  {
    id: "green-wall",
    name: "Зелёная стена",
    prompt:
      "Smooth slow pan across a lush green living wall with boxwood and ivy and white floral accents, warm uplighting, premium botanical elegance.",
  },
  {
    id: "coastal-breeze",
    name: "Морской бриз",
    prompt:
      "Airy slow pan over coastal luxury decor with white and sand palette, driftwood and sea glass details, linen drapery flowing in a light sea breeze.",
  },
  {
    id: "provence-lavender",
    name: "Прованс",
    prompt:
      "Gentle slow dolly-in over Provence style decor with lavender bouquets, vintage wooden furniture and lace, warm summer sunlight, romantic French countryside mood.",
  },
  {
    id: "oriental-luxury",
    name: "Восточная роскошь",
    prompt:
      "Rich slow orbit around oriental luxury decor with gold lanterns, burgundy and gold fabrics, carved details and plush cushions, warm ambient light.",
  },
  {
    id: "modern-luxury-lounge",
    name: "Современный люкс лаунж",
    prompt:
      "Smooth slow pan across a modern luxury lounge with velvet sofas, marble tables and sculptural florals, brushed brass accents, soft ambient hotel lighting.",
  },
  {
    id: "luxury-centerpiece",
    name: "Цветочный центр стола",
    prompt:
      "Elegant slow dolly-in towards a luxury table centerpiece with crystal vase and white orchids, cascading greenery and gold candle holders, refined restaurant ambiance.",
  },
];
