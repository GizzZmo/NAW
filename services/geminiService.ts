/**
 * Client-side gateway for NAW's symbolic music planner.
 *
 * The Gemini credential must never be shipped to the browser. The actual
 * provider call is performed by the same-origin `/api/generate-blueprint`
 * server endpoint.
 */

export interface BlueprintEvent {
  step: number;
  note: string;
  duration: number;
  velocity: number;
}

export interface BlueprintStem {
  type: 'DRUMS' | 'BASS' | 'VOCALS' | 'OTHER' | string;
  description: string;
  pattern: BlueprintEvent[];
}

export interface SongBlueprint {
  title: string;
  suggestedBpm: number;
  stems: BlueprintStem[];
}

export interface BlueprintOptions {
  styleAdapter?: string;
  styleStrength?: number;
  temperature?: number;
  audioRefName?: string;
}

/** Generate a symbolic musical blueprint through the protected server API. */
export const generateSongBlueprint = async (
  prompt: string,
  bpm: number,
  options: BlueprintOptions = {},
  signal?: AbortSignal,
): Promise<SongBlueprint> => {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) throw new Error('A music prompt is required.');
  if (cleanPrompt.length > 2000) throw new Error('The music prompt must be 2,000 characters or fewer.');
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) {
    throw new Error('Tempo must be between 40 and 240 BPM.');
  }

  const response = await fetch('/api/generate-blueprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: cleanPrompt, bpm, options }),
    signal,
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Music generation failed (HTTP ${response.status}).`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as SongBlueprint).stems)) {
    throw new Error('The music service returned an invalid blueprint.');
  }

  return payload as SongBlueprint;
};
