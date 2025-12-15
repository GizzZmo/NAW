/**
 * @fileoverview Type definitions for the Neural Audio Workstation (NAW)
 * 
 * This file contains all TypeScript interfaces and types used throughout the application.
 * The architecture follows a stem-aware approach where music is separated into 4 independent
 * tracks (DRUMS, BASS, VOCALS, OTHER) that are generated and edited independently but remain
 * phase-aligned for professional mixing.
 * 
 * @module types
 */

/**
 * Enum representing the four stem types in NAW's architecture.
 * 
 * These stem types align with standard music source separation models like Demucs:
 * - DRUMS: Percussive elements (kick, snare, hi-hats, percussion)
 * - BASS: Low-frequency harmonic content (bass guitar, sub-bass, bass synth)
 * - VOCALS: Voice content (lead vocals, harmonies, vocal effects)
 * - OTHER: Everything else (melody, chords, atmosphere, sound effects)
 * 
 * @enum {string}
 */
export enum StemType {
  DRUMS = 'DRUMS',
  BASS = 'BASS',
  VOCALS = 'VOCALS',
  OTHER = 'OTHER'
}

/**
 * Represents a temporal prompt keyframe for style transitions.
 * 
 * Prompt keyframes allow users to specify different musical styles at different points
 * in the timeline. The AI interpolates between keyframes to create smooth transitions.
 * 
 * @interface PromptKeyframe
 * @example
 * {
 *   id: "prompt_1",
 *   bar: 16,
 *   text: "Drop, aggressive dubstep bass, heavy compression",
 *   timestamp: 1705334400000
 * }
 */
export interface PromptKeyframe {
  /** Unique identifier for the keyframe */
  id: string;
  /** Bar position on the timeline (0-based, float for sub-bar precision) */
  bar: number;
  /** Text prompt describing the desired musical style for this section */
  text: string;
  /** Unix timestamp when this keyframe was created (for versioning/history) */
  timestamp: number;
}

/**
 * Represents a single musical event (note, drum hit, or rest).
 * 
 * NoteEvents are the atomic units of musical content in NAW. They map to the output
 * of the Semantic Planner (Stage 1) before being rendered into audio by the
 * Acoustic Renderer (Stage 2).
 * 
 * @interface NoteEvent
 * @example
 * // Drum hit
 * { step: 0, note: "KICK", duration: 1, velocity: 1.0 }
 * 
 * // Melodic note
 * { step: 8, note: "C#3", duration: 4, velocity: 0.8 }
 * 
 * // AI suggestion (ghost note)
 * { step: 12, note: "G4", duration: 2, velocity: 0.7, isGhost: true }
 */
export interface NoteEvent {
  /** 
   * Position on 16th-note grid (0-63 for 4 bars, 0-127 for 8 bars, etc.)
   * Calculated as: (bar * 4 + beat) * 4 + sixteenth
   */
  step: number;
  
  /** 
   * Note value - format depends on stem type:
   * - DRUMS: "KICK", "SNARE", "CHAT" (closed hi-hat), "OHAT" (open hi-hat)
   * - MELODIC: Scientific pitch notation "C#3", "Ab4", etc. or MIDI number (0-127)
   */
  note: string | number;
  
  /** Duration in steps (16th notes). Duration=4 is a quarter note */
  duration: number;
  
  /** 
   * Velocity/intensity from 0.0 (silent) to 1.0 (full volume)
   * Also affects timbre in neural synthesis (soft vs hard hit)
   */
  velocity: number;
  
  /** 
   * If true, this is an AI suggestion ("ghost note") not yet committed by the user.
   * Rendered with reduced opacity in the UI. Similar to GitHub Copilot suggestions.
   */
  isGhost?: boolean;
}

/**
 * Represents a clip (audio region) on a track.
 * 
 * Clips are containers for musical events and metadata. They can be moved, copied,
 * and edited independently. Each clip belongs to a single track and stem type.
 * 
 * @interface Clip
 * @example
 * {
 *   id: "clip_abc123",
 *   name: "House Drums Loop",
 *   startBar: 0,
 *   lengthBars: 4,
 *   type: StemType.DRUMS,
 *   color: "#f87171",
 *   events: [...noteEvents],
 *   latentData: [] // Future: RVQ codebook indices from neural codec
 * }
 */
export interface Clip {
  /** Unique identifier for the clip */
  id: string;
  
  /** Human-readable name displayed in UI */
  name: string;
  
  /** Starting position on timeline (bar units, 0-based) */
  startBar: number;
  
  /** Duration of the clip in bars */
  lengthBars: number;
  
  /** Stem type this clip belongs to (determines track placement) */
  type: StemType;
  
  /** Hex color for visualization (inherited from stem type) */
  color: string;
  
  /** Array of musical events (notes, drum hits) contained in this clip */
  events: NoteEvent[];
  
  /** 
   * Future: Raw latent data from neural audio codec (DAC/EnCodec).
   * Will contain RVQ codebook indices for each time step.
   * Currently empty (simulation phase).
   */
  latentData: number[];
}

/**
 * Represents a single track (stem) in the project.
 * 
 * Tracks are the horizontal lanes in the timeline view. Each track is dedicated
 * to one stem type and contains multiple clips. Tracks have independent mixing
 * controls (volume, mute, solo).
 * 
 * @interface Track
 * @example
 * {
 *   id: "t1",
 *   name: "Drums (stem)",
 *   type: StemType.DRUMS,
 *   volume: 0.8,
 *   muted: false,
 *   solo: false,
 *   clips: [...clips]
 * }
 */
export interface Track {
  /** Unique identifier for the track */
  id: string;
  
  /** Display name shown in track header */
  name: string;
  
  /** Stem type this track represents */
  type: StemType;
  
  /** Volume level (0.0 = silent, 1.0 = full volume) */
  volume: number;
  
  /** If true, track is muted (no audio output) */
  muted: boolean;
  
  /** If true, only this track plays (all others muted except other solo'd tracks) */
  solo: boolean;
  
  /** Array of clips placed on this track */
  clips: Clip[];
}

/**
 * Represents the complete state of a NAW project.
 * 
 * This is the root state object that contains all project data. It's serialized
 * to JSON for save/load functionality and managed via React state in App.tsx.
 * 
 * @interface ProjectState
 * @example
 * {
 *   bpm: 128,
 *   isPlaying: true,
 *   currentBar: 8.5,  // Playhead at bar 8, beat 3
 *   totalBars: 32,
 *   tracks: [...4 tracks],
 *   prompts: [...keyframes],
 *   generationStage: 'RENDERING',
 *   generationProgress: 75
 * }
 */
export interface ProjectState {
  /** Tempo in beats per minute (60-240 typical range) */
  bpm: number;
  
  /** Playback state: true = playing, false = stopped */
  isPlaying: boolean;
  
  /** 
   * Current playhead position in bars (float for sub-bar precision).
   * E.g., 8.5 = bar 8, beat 3 (middle of bar 8 in 4/4 time)
   */
  currentBar: number;
  
  /** Total project length in bars (typically 32, 64, or 128) */
  totalBars: number;
  
  /** Array of 4 tracks (one per stem type) */
  tracks: Track[];
  
  /** Array of prompt keyframes for temporal style control */
  prompts: PromptKeyframe[];
  
  /** 
   * Current stage of AI generation pipeline:
   * - IDLE: Not generating
   * - PLANNING: Stage 1 (Semantic Planner / AR Transformer) in progress
   * - RENDERING: Stage 2 (Acoustic Renderer / Flow Matching) in progress
   * - COMPLETED: Generation finished, displaying results
   */
  generationStage: 'IDLE' | 'PLANNING' | 'RENDERING' | 'COMPLETED';
  
  /** Generation progress percentage (0-100) for UI feedback */
  generationProgress: number;
}

/**
 * Request payload for AI generation (future API interface).
 * 
 * @interface GenerationRequest
 * @deprecated Currently using direct Gemini API calls. This will be used when
 *             we implement the custom neural pipeline (AR + Flow Matching).
 */
export interface GenerationRequest {
  /** Text prompt describing desired musical output */
  prompt: string;
  
  /** Desired output length in bars */
  durationBars: number;
  
  /** Sampling temperature (0.0 = deterministic, 1.0 = very random) */
  temperature: number;
}

/**
 * Configuration for spectrogram editing tools.
 * 
 * Controls the behavior of the SpectrogramEditor component, including which
 * editing mode is active and whether to show latent representations.
 * 
 * @interface SpectrogramTool
 */
export interface SpectrogramTool {
  /** 
   * Current tool mode:
   * - SELECT: Default cursor, no editing
   * - BRUSH: Paint mask for inpainting
   * - ERASE: Remove mask regions
   */
  mode: 'SELECT' | 'BRUSH' | 'ERASE';
  
  /** Brush size in pixels (for BRUSH/ERASE modes) */
  brushSize: number;
  
  /** 
   * If true, display latent codebook indices instead of audio spectrogram.
   * Useful for debugging and understanding the neural codec's internal representation.
   */
  showLatents: boolean;
}

/**
 * Type for selecting between visualization modes.
 * 
 * Determines whether clips are rendered as spectrograms (frequency domain)
 * or piano rolls (symbolic note grid).
 * 
 * @type EditViewMode
 */
export type EditViewMode = 'SPECTROGRAM' | 'PIANO_ROLL';
