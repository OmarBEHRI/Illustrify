// TODO Roadmap:
// - [ ] Implement YouTube caption extraction (/api/extract/youtube)
// - [ ] Integrate image generation API and persist image assets
// - [ ] Integrate text-to-speech (TTS) for narration audio
// - [ ] Assemble video from images + audio with pan/zoom and crossfades
// - [ ] Replace current simulation in /api/generate with real pipeline

export type Scene = {
  imageDescription: string;
  narration: string;
};

function buildSystemPrompt(visualStyle: string) {
  return [
    "You are an expert Video Director AI.",
    "Your job: Given some input text, first extract the complete story, translate it to English if needed, preserving ALL details.",
    "Then transform the story into a sequence of scenes.",
    "Each scene must be a pair: (image_description, narration).",
    "Image description requirements:",
    "- Be fully objective. Do not include non-visual or non-renderable concepts (e.g., character names, inner thoughts, or known city names).",
    "- If characters must appear, describe them visually (age, gender presentation, hairstyle, clothing, distinguishing features) and keep them consistent across scenes.",
    "- Describe WHERE and WHEN (Night, Sunset, Morning, Mid day, etc.).",
    "- Indicate facial expressions and visible emotions objectively.",
    "- Always append the visual style at the very end of the description as: Visual style: {visual_style}.",
    "Narration requirements:",
    "- Human-sounding, high-quality prose.",
    "- Preserve story details and maintain consistency across scenes.",
    "Output strictly as pure JSON with this shape: { \"scenes\": [ { \"image_description\": string, \"narration\": string }, ... ] }.",
    `Use the following visual style token everywhere: {visual_style} = "${visualStyle}".`,
  ].join("\n");
}

function buildUserPrompt(inputText: string) {
  return [
    "Input text:",
    inputText,
    "\nPlease produce exactly 2 scenes total for testing purposes.",
    "Do not include any commentary outside of JSON."
  ].join("\n");
}

function coerceToScenes(raw: any, visualStyle: string): Scene[] {
  try {
    if (!raw || !Array.isArray(raw)) return [];
    return raw
      .map((s: any) => ({
        imageDescription: String(s.image_description || s.imageDescription || "").trim(),
        narration: String(s.narration || "").trim(),
      }))
      .filter((s: Scene) => s.imageDescription && s.narration)
      .map((s: Scene) => {
        const hasStyleTag = /visual style\s*:/i.test(s.imageDescription);
        return {
          ...s,
          imageDescription: hasStyleTag
            ? s.imageDescription
            : `${s.imageDescription.trim()}  Visual style: ${visualStyle}`,
        };
      });
  } catch {
    return [];
  }
}

async function callOpenRouter(inputText: string, visualStyle: string): Promise<Scene[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
      'X-Title': process.env.SITE_NAME || 'Illustrify',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5-nano',
      temperature: 0.3,
      messages: [
        { role: 'system', content: buildSystemPrompt(visualStyle) },
        { role: 'user', content: buildUserPrompt(inputText) },
      ],
    }),
  });

  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(content);
    const scenes = coerceToScenes(parsed?.scenes, visualStyle);
    return scenes.length ? scenes : null;
  } catch {
    // Try to salvage JSON from code fences if any
    const m = content.match(/```json\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/i);
    if (m && m[1]) {
      try {
        const parsed = JSON.parse(m[1]);
        const scenes = coerceToScenes(parsed?.scenes, visualStyle);
        return scenes.length ? scenes : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function basicFallbackScenes(inputText: string, visualStyle: string): Scene[] {
  const sentences = inputText
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  const N = Math.min(12, Math.max(6, Math.ceil(sentences.length / 2)));
  const stride = Math.ceil(sentences.length / N);
  const scenes: Scene[] = [];
  for (let i = 0; i < sentences.length && scenes.length < N; i += stride) {
    const s = sentences[i];
    scenes.push({
      imageDescription: `${s}. Visual style: ${visualStyle}`,
      narration: s,
    });
  }
  if (!scenes.length) {
    scenes.push({ imageDescription: `A neutral title card. Visual style: ${visualStyle}`, narration: inputText.slice(0, 200) });
  }
  return scenes;
}

export async function directVideo(inputText: string, visualStyle: string): Promise<Scene[]> {
  // Try LLM first if API key present
  try {
    const viaOpenRouter = await callOpenRouter(inputText, visualStyle);
    if (viaOpenRouter && viaOpenRouter.length) return viaOpenRouter;
  } catch {
    // ignore and fallback
  }
  return basicFallbackScenes(inputText, visualStyle);
}