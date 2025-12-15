
export enum StemType {
  DRUMS = 'DRUMS',
  BASS = 'BASS',
  VOCALS = 'VOCALS',
  OTHER = 'OTHER'
}

export interface PromptKeyframe {
  id: string;
  bar: number;
  text: string;
  timestamp: number;
}

export interface NoteEvent {
  step: number; // 16th note grid step (0-63 for 4 bars)
  note: string | number; // "KICK", "SNARE", "C#3", or MIDI number
  duration: number; // in steps
  velocity: number; // 0.0 - 1.0
  isGhost?: boolean; // If true, it's an AI suggestion not yet committed
}

export interface Clip {
  id: string;
  name: string;
  startBar: number;
  lengthBars: number;
  type: StemType;
  color: string;
  events: NoteEvent[];
  // Simulated latent data for visualization
  latentData: number[]; 
}

export interface Track {
  id: string;
  name: string;
  type: StemType;
  volume: number; // 0-1
  muted: boolean;
  solo: boolean;
  clips: Clip[];
}

export interface ProjectState {
  bpm: number;
  isPlaying: boolean;
  currentBar: number;
  totalBars: number;
  tracks: Track[];
  prompts: PromptKeyframe[];
  generationStage: 'IDLE' | 'PLANNING' | 'RENDERING' | 'COMPLETED';
  generationProgress: number; // 0-100
}

export interface GenerationRequest {
  prompt: string;
  durationBars: number;
  temperature: number;
}

export interface SpectrogramTool {
  mode: 'SELECT' | 'BRUSH' | 'ERASE';
  brushSize: number;
  showLatents: boolean;
}

export type EditViewMode = 'SPECTROGRAM' | 'PIANO_ROLL';
