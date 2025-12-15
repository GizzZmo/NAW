/**
 * @fileoverview Configuration constants for the Neural Audio Workstation (NAW)
 * 
 * This file contains all magic numbers, default values, and configuration settings
 * used throughout the application. Centralizing these values makes it easy to adjust
 * the UI layout, default project structure, and visual styling.
 * 
 * @module constants
 */

import { StemType } from './types';

/**
 * Default project length in bars.
 * 
 * This determines the width of the timeline and the maximum duration of generated
 * content. 32 bars is approximately 60 seconds at 128 BPM (typical for electronic music).
 * 
 * @constant {number}
 */
export const TOTAL_BARS = 32;

/**
 * Horizontal zoom level: pixels per bar on the timeline.
 * 
 * Higher values = more zoomed in (larger bars, less visible on screen).
 * Lower values = more zoomed out (smaller bars, more visible on screen).
 * 
 * At 60 pixels/bar with 32 bars, the timeline width is 1920px (fits 1080p screen).
 * 
 * @constant {number}
 */
export const PIXELS_PER_BAR = 60;

/**
 * Vertical height of each track in pixels.
 * 
 * This affects both the timeline view and how much vertical space is available
 * for rendering spectrograms or piano rolls within clips.
 * 
 * @constant {number}
 */
export const TRACK_HEIGHT = 100;

/**
 * Initial track configuration for new projects.
 * 
 * NAW always starts with 4 tracks, one for each stem type. This follows the
 * architecture of source separation models like Demucs and MusicGen-Stem.
 * 
 * @constant {Array<Track>}
 * @example
 * // Accessing initial tracks
 * const [drums, bass, vocals, other] = INITIAL_TRACKS;
 */
export const INITIAL_TRACKS = [
  { 
    id: 't1', 
    name: 'Drums (stem)', 
    type: StemType.DRUMS, 
    volume: 0.8, 
    muted: false, 
    solo: false, 
    clips: [] 
  },
  { 
    id: 't2', 
    name: 'Bass (stem)', 
    type: StemType.BASS, 
    volume: 0.75, 
    muted: false, 
    solo: false, 
    clips: [] 
  },
  { 
    id: 't3', 
    name: 'Vocals (stem)', 
    type: StemType.VOCALS, 
    volume: 0.9, 
    muted: false, 
    solo: false, 
    clips: [] 
  },
  { 
    id: 't4', 
    name: 'Other (stem)', 
    type: StemType.OTHER, 
    volume: 0.7, 
    muted: false, 
    solo: false, 
    clips: [] 
  },
];

/**
 * Color palette for stem visualization.
 * 
 * Each stem type has a dedicated color used in:
 * - Track headers
 * - Clip backgrounds
 * - Spectrogram tints
 * - Mixer channel indicators
 * 
 * Colors chosen for:
 * - High contrast (accessibility)
 * - Semantic association (red = drums = energy, blue = vocals = sky/breath)
 * - Consistency with common DAW color schemes
 * 
 * @constant {Record<StemType, string>}
 * @example
 * // Get color for drums track
 * const drumsColor = STEM_COLORS[StemType.DRUMS]; // "#f87171"
 */
export const STEM_COLORS = {
  [StemType.DRUMS]: '#f87171',   // Red (energetic, attention-grabbing)
  [StemType.BASS]: '#fbbf24',    // Amber (warm, foundational)
  [StemType.VOCALS]: '#38bdf8',  // Blue (airy, human)
  [StemType.OTHER]: '#a78bfa',   // Purple (ethereal, everything else)
};
