/**
 * DAW project export (JSON + optional WAV stems).
 *
 * Produces a portable project file that can be re-imported or converted
 * to other DAW formats. Neural WAV stems are referenced by filename.
 */

export interface DawProjectTrack {
  id: string;
  name: string;
  type: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  clips: Array<{
    id: string;
    name: string;
    startBar: number;
    lengthBars: number;
    notes: Array<{ step: number; note: string; duration: number; velocity: number }>;
  }>;
  effects?: Record<string, number>;
}

export interface DawProject {
  version: string;
  title: string;
  bpm: number;
  totalBars: number;
  createdAt: string;
  tracks: DawProjectTrack[];
  /** Optional map of trackId → WAV filename for neural/synthesized stems. */
  stemFiles?: Record<string, string>;
}

export function buildDawProject(input: {
  title: string;
  bpm: number;
  totalBars: number;
  tracks: DawProjectTrack[];
  stemFiles?: Record<string, string>;
}): DawProject {
  return {
    version: '1.8.0',
    title: input.title || 'Untitled',
    bpm: input.bpm,
    totalBars: input.totalBars,
    createdAt: new Date().toISOString(),
    tracks: input.tracks,
    stemFiles: input.stemFiles,
  };
}

export function dawProjectToJson(project: DawProject): string {
  return JSON.stringify(project, null, 2);
}

export function downloadDawProject(project: DawProject, filename = 'naw-project.json'): void {
  const blob = new Blob([dawProjectToJson(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
