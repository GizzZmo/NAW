import { GoogleGenAI, Type } from '@google/genai';

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface GenerationOptions {
  styleAdapter?: string;
  styleStrength?: number;
  temperature?: number;
  audioRefName?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const numericOption = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!isRecord(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  const prompt = typeof req.body.prompt === 'string' ? req.body.prompt.trim() : '';
  const bpm = Number(req.body.bpm);
  const options = isRecord(req.body.options) ? req.body.options : {};

  if (!prompt || prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt is required and must be 2,000 characters or fewer.' });
  }
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) {
    return res.status(400).json({ error: 'Tempo must be between 40 and 240 BPM.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  const genOptions: GenerationOptions = {
    styleAdapter: typeof options.styleAdapter === 'string' ? options.styleAdapter.slice(0, 64) : undefined,
    styleStrength: clamp(numericOption(options.styleStrength, 0.7), 0, 1),
    temperature: clamp(numericOption(options.temperature, 0.8), 0, 2),
    audioRefName: typeof options.audioRefName === 'string' ? options.audioRefName.slice(0, 120) : undefined,
  };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a music composition planner for a stem-based DAW. Generate a 32-step (2-bar) symbolic pattern for drums, bass, vocals, and other. BPM context: ${bpm}. Style: ${genOptions.styleAdapter ?? 'general'}. Prompt: ${prompt}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            suggestedBpm: { type: Type.NUMBER },
            stems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  description: { type: Type.STRING },
                  pattern: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        step: { type: Type.NUMBER },
                        note: { type: Type.STRING },
                        duration: { type: Type.NUMBER },
                        velocity: { type: Type.NUMBER },
                      },
                      required: ['step', 'note', 'duration', 'velocity'],
                    },
                  },
                },
                required: ['type', 'description', 'pattern'],
              },
            },
          },
          required: ['title', 'suggestedBpm', 'stems'],
        },
      },
    });

    const text = result.text;
    if (!text) throw new Error('The model returned an empty response.');
    const blueprint: unknown = JSON.parse(text);
    if (!isRecord(blueprint) || !Array.isArray(blueprint.stems)) {
      throw new Error('The model returned an invalid blueprint.');
    }

    const stems = blueprint.stems.filter((stem): stem is Record<string, unknown> =>
      isRecord(stem) && typeof stem.type === 'string' && Array.isArray(stem.pattern),
    ).map((stem) => ({
      type: String(stem.type).toUpperCase(),
      description: typeof stem.description === 'string' ? stem.description.slice(0, 120) : 'Generated pattern',
      pattern: (stem.pattern as unknown[]).filter((event): event is Record<string, unknown> =>
        isRecord(event) && Number.isInteger(event.step) && Number(event.step) >= 0 && Number(event.step) < 32 &&
        typeof event.note === 'string' && Number.isFinite(Number(event.duration)) &&
        Number(event.duration) >= 1 && Number(event.duration) <= 32 &&
        Number.isFinite(Number(event.velocity)),
      ).map((event) => ({
        step: Number(event.step),
        note: String(event.note).slice(0, 12),
        duration: Math.round(Number(event.duration)),
        velocity: clamp(Number(event.velocity), 0, 1),
      })),
    }));

    if (stems.length === 0) throw new Error('The model returned no valid musical stems.');

    return res.status(200).json({
      title: typeof blueprint.title === 'string' ? blueprint.title.slice(0, 120) : 'Untitled Blueprint',
      suggestedBpm: clamp(Number(blueprint.suggestedBpm) || bpm, 40, 240),
      stems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Music generation failed.';
    return res.status(502).json({ error: message });
  }
}
