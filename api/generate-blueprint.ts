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

// Simple in-memory rate limiter (best-effort; serverless instances are ephemeral).
// For production use Vercel KV / Upstash Redis.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function getClientId(req: ApiRequest & { headers?: Record<string, string | string[] | undefined> }): string {
  const headers = req.headers ?? {};
  const forwarded = headers['x-forwarded-for'] ?? headers['X-Forwarded-For'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (typeof ip === 'string' ? ip.split(',')[0].trim() : 'unknown') || 'unknown';
}

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(clientId);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

export default async function handler(req: ApiRequest & { headers?: Record<string, string | string[] | undefined> }, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Optional API key gate (set NAW_API_KEY in env to enable)
  const requiredKey = process.env.NAW_API_KEY;
  if (requiredKey) {
    const provided = req.headers?.['x-api-key'] ?? req.headers?.['X-API-Key'];
    const key = Array.isArray(provided) ? provided[0] : provided;
    if (key !== requiredKey) {
      return res.status(401).json({ error: 'Invalid or missing X-API-Key.' });
    }
  }

  const clientId = getClientId(req);
  const limit = checkRateLimit(clientId);
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  if (!isRecord(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  const prompt = typeof req.body.prompt === 'string' ? req.body.prompt.trim() : '';
  const bpm = Number(req.body.bpm);
  const options = isRecord(req.body.options) ? req.body.options : {};
  const agent = isRecord(req.body.agent) ? req.body.agent : {};

  if (!prompt || prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt is required and must be 2,000 characters or fewer.' });
  }
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) {
    return res.status(400).json({ error: 'Tempo must be between 40 and 240 BPM.' });
  }

  const provider = typeof agent.provider === 'string' ? agent.provider : 'gemini';
  const userKey = typeof agent.apiKey === 'string' ? agent.apiKey.trim() : '';
  const modelOverride = typeof agent.modelOverride === 'string' ? agent.modelOverride.trim() : '';

  const envMap: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    grok: process.env.XAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };

  const apiKey = userKey || envMap[provider] || '';
  if (!apiKey) {
    return res.status(400).json({
      error: `No API key for provider "${provider}". Enter one in the Agent settings or set the matching env var on the server.`,
    });
  }

  const genOptions: GenerationOptions = {
    styleAdapter: typeof options.styleAdapter === 'string' ? options.styleAdapter.slice(0, 64) : undefined,
    styleStrength: clamp(numericOption(options.styleStrength, 0.7), 0, 1),
    temperature: clamp(numericOption(options.temperature, 0.8), 0, 2),
    audioRefName: typeof options.audioRefName === 'string' ? options.audioRefName.slice(0, 120) : undefined,
  };

  const systemPrompt = `You are a music composition planner for a stem-based DAW. Generate a 32-step (2-bar) symbolic pattern for drums, bass, vocals, and other. BPM context: ${bpm}. Style: ${genOptions.styleAdapter ?? 'general'}. Prompt: ${prompt}. Respond with valid JSON only matching the schema: { "title": string, "suggestedBpm": number, "stems": [ { "type": string, "description": string, "pattern": [ { "step": number, "note": string, "duration": number, "velocity": number } ] } ] }`;

  try {
    let text = '';

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: modelOverride || 'gemini-2.5-flash',
        contents: systemPrompt,
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
      text = result.text ?? '';
    } else if (provider === 'anthropic') {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelOverride || 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [{ role: 'user', content: systemPrompt }],
        }),
      });
      if (!resp.ok) throw new Error(`Anthropic error ${resp.status}`);
      const data = await resp.json() as { content?: { text?: string }[] };
      text = data.content?.[0]?.text ?? '';
    } else {
      // OpenAI-compatible: openai, grok, openrouter
      const baseUrls: Record<string, string> = {
        openai: 'https://api.openai.com/v1',
        grok: 'https://api.x.ai/v1',
        openrouter: 'https://openrouter.ai/api/v1',
      };
      const models: Record<string, string> = {
        openai: 'gpt-4o-mini',
        grok: 'grok-3',
        openrouter: 'google/gemini-2.5-flash',
      };
      const base = baseUrls[provider] || 'https://api.openai.com/v1';
      const model = modelOverride || models[provider] || 'gpt-4o-mini';

      const resp = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: systemPrompt }],
          response_format: { type: 'json_object' },
          temperature: genOptions.temperature,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`${provider} error ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
      text = data.choices?.[0]?.message?.content ?? '';
    }

    if (!text) throw new Error('The model returned an empty response.');
    // Strip markdown fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const blueprint: unknown = JSON.parse(cleaned);
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
