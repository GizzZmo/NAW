import { StemType } from './types';

export const TOTAL_BARS = 32;
export const PIXELS_PER_BAR = 60;
export const TRACK_HEIGHT = 100;

export const INITIAL_TRACKS = [
  { id: 't1', name: 'Drums (stem)', type: StemType.DRUMS, volume: 0.8, muted: false, solo: false, clips: [] },
  { id: 't2', name: 'Bass (stem)', type: StemType.BASS, volume: 0.75, muted: false, solo: false, clips: [] },
  { id: 't3', name: 'Vocals (stem)', type: StemType.VOCALS, volume: 0.9, muted: false, solo: false, clips: [] },
  { id: 't4', name: 'Other (stem)', type: StemType.OTHER, volume: 0.7, muted: false, solo: false, clips: [] },
];

export const STEM_COLORS = {
  [StemType.DRUMS]: '#f87171', // Red
  [StemType.BASS]: '#fbbf24', // Amber
  [StemType.VOCALS]: '#38bdf8', // Blue
  [StemType.OTHER]: '#a78bfa', // Purple
};
