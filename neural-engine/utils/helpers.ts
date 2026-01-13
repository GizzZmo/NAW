/**
 * Neural Engine Helper Utilities
 * 
 * Convenient helper functions for common neural engine tasks.
 * These utilities simplify working with the neural engine components.
 */

import {
  DACCodec,
  SemanticPlanner,
  AcousticRenderer,
  Vocoder,
  VocoderType,
  type DACLatent,
  type SemanticSkeleton,
} from '../index';

/**
 * Quality preset configuration
 */
export type QualityPreset = 'preview' | 'draft' | 'production' | 'master';

/**
 * Get recommended configuration for quality preset
 */
export function getQualityPresetConfig(preset: QualityPreset) {
  const configs = {
    preview: {
      vocoderType: VocoderType.VOCOS,
      numSteps: 10,
      guidanceScale: 2.0,
      modelSize: '500M' as const,
      description: 'Fast iteration (5x realtime, good quality)',
    },
    draft: {
      vocoderType: VocoderType.VOCOS,
      numSteps: 15,
      guidanceScale: 2.5,
      modelSize: '500M' as const,
      description: 'Balanced preview (3x realtime, better quality)',
    },
    production: {
      vocoderType: VocoderType.DISCODER,
      numSteps: 20,
      guidanceScale: 3.0,
      modelSize: '1B' as const,
      description: 'High quality (1x realtime, excellent quality)',
    },
    master: {
      vocoderType: VocoderType.DISCODER,
      numSteps: 30,
      guidanceScale: 3.5,
      modelSize: '2B' as const,
      description: 'Maximum quality (0.5x realtime, pristine quality)',
    },
  };

  return configs[preset];
}

/**
 * Create a full neural engine pipeline with recommended settings
 */
export async function createPipeline(preset: QualityPreset = 'draft') {
  const config = getQualityPresetConfig(preset);

  // Map quality model size to planner model size
  const plannerModelSize = config.modelSize === '500M' ? '500M' : '1B';

  const codec = new DACCodec();
  const planner = new SemanticPlanner({
    modelSize: plannerModelSize,
  });
  const renderer = new AcousticRenderer({
    numSteps: config.numSteps,
    guidanceScale: config.guidanceScale,
    modelSize: config.modelSize,
    vocoderType: config.vocoderType,
  });
  const vocoder = new Vocoder({
    type: config.vocoderType,
  });

  // Initialize all components in parallel
  await Promise.all([
    codec.initialize(),
    planner.initialize(),
    renderer.initialize(),
    vocoder.initialize(),
  ]);

  return {
    codec,
    planner,
    renderer,
    vocoder,
    preset,
    config,
  };
}

/**
 * Calculate estimated generation time based on hardware and settings
 */
export interface TimeEstimate {
  semantic: number; // seconds
  acoustic: number; // seconds
  vocoding: number; // seconds
  total: number; // seconds
}

export function estimateGenerationTime(
  bars: number,
  preset: QualityPreset,
  gpu: 'RTX4090' | 'RTX3090' | 'RTX3060' | 'GTX1660' | 'CPU' = 'RTX3090'
): TimeEstimate {
  // Base times for 32 bars on RTX 3090
  const baseTimes = {
    semantic: 2.0,
    acoustic: 10.0,
    vocoding: 1.0,
  };

  // GPU performance multipliers
  const gpuMultipliers = {
    RTX4090: 0.75,
    RTX3090: 1.0,
    RTX3060: 1.8,
    GTX1660: 5.0,
    CPU: 20.0,
  };

  // Quality preset multipliers
  const qualityMultipliers = {
    preview: 0.5,
    draft: 0.75,
    production: 1.0,
    master: 1.5,
  };

  const barMultiplier = bars / 32;
  const gpuMultiplier = gpuMultipliers[gpu];
  const qualityMultiplier = qualityMultipliers[preset];

  const semantic = baseTimes.semantic * barMultiplier * gpuMultiplier;
  const acoustic = baseTimes.acoustic * barMultiplier * gpuMultiplier * qualityMultiplier;
  const vocoding = baseTimes.vocoding * barMultiplier * gpuMultiplier;

  return {
    semantic: Math.round(semantic * 10) / 10,
    acoustic: Math.round(acoustic * 10) / 10,
    vocoding: Math.round(vocoding * 10) / 10,
    total: Math.round((semantic + acoustic + vocoding) * 10) / 10,
  };
}

/**
 * Format time in human-readable format
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Calculate audio duration from sample count
 */
export function samplesToSeconds(samples: number, sampleRate: number = 44100): number {
  return samples / sampleRate;
}

/**
 * Calculate sample count from duration
 */
export function secondsToSamples(seconds: number, sampleRate: number = 44100): number {
  return Math.floor(seconds * sampleRate);
}

/**
 * Calculate bar duration in samples
 */
export function barsToSamples(
  bars: number,
  bpm: number,
  sampleRate: number = 44100,
  beatsPerBar: number = 4
): number {
  const beats = bars * beatsPerBar;
  const seconds = (beats / bpm) * 60;
  return secondsToSamples(seconds, sampleRate);
}

/**
 * Calculate number of bars from sample count
 */
export function samplesToBars(
  samples: number,
  bpm: number,
  sampleRate: number = 44100,
  beatsPerBar: number = 4
): number {
  const seconds = samplesToSeconds(samples, sampleRate);
  const beats = (seconds / 60) * bpm;
  return beats / beatsPerBar;
}

/**
 * Normalize audio to target peak level
 */
export function normalizeAudio(audio: Float32Array, targetPeak: number = 0.95): Float32Array {
  // Find peak
  let peak = 0;
  for (let i = 0; i < audio.length; i++) {
    const abs = Math.abs(audio[i]);
    if (abs > peak) peak = abs;
  }

  // Avoid division by zero
  if (peak === 0) return audio;

  // Calculate gain
  const gain = targetPeak / peak;

  // Apply gain
  const normalized = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) {
    normalized[i] = audio[i] * gain;
  }

  return normalized;
}

/**
 * Apply fade in/out to audio
 */
export function applyFades(
  audio: Float32Array,
  fadeInSamples: number = 0,
  fadeOutSamples: number = 0
): Float32Array {
  const result = new Float32Array(audio);

  // Fade in
  for (let i = 0; i < fadeInSamples && i < audio.length; i++) {
    const gain = i / fadeInSamples;
    result[i] *= gain;
  }

  // Fade out
  const fadeOutStart = audio.length - fadeOutSamples;
  for (let i = fadeOutStart; i < audio.length; i++) {
    const gain = (audio.length - i) / fadeOutSamples;
    result[i] *= gain;
  }

  return result;
}

/**
 * Mix multiple audio buffers
 */
export function mixAudio(
  buffers: Float32Array[],
  volumes: number[] = []
): Float32Array {
  if (buffers.length === 0) return new Float32Array(0);

  // Use default volume of 1.0 if not specified
  const gains = volumes.length === buffers.length 
    ? volumes 
    : buffers.map(() => 1.0);

  // Find longest buffer
  const maxLength = Math.max(...buffers.map(b => b.length));

  // Mix buffers
  const mixed = new Float32Array(maxLength);
  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i];
    const gain = gains[i];
    for (let j = 0; j < buffer.length; j++) {
      mixed[j] += buffer[j] * gain;
    }
  }

  return mixed;
}

/**
 * Calculate RMS (Root Mean Square) level
 */
export function calculateRMS(audio: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < audio.length; i++) {
    sum += audio[i] * audio[i];
  }
  return Math.sqrt(sum / audio.length);
}

/**
 * Calculate peak level in dB
 */
export function calculatePeakDB(audio: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < audio.length; i++) {
    const abs = Math.abs(audio[i]);
    if (abs > peak) peak = abs;
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

/**
 * Progress tracking helper
 */
export class ProgressTracker {
  private stages: Map<string, { current: number; total: number }> = new Map();
  private callbacks: ((progress: number, stage: string) => void)[] = [];

  /**
   * Add a stage to track
   */
  addStage(name: string, total: number) {
    this.stages.set(name, { current: 0, total });
  }

  /**
   * Update progress for a stage
   */
  update(stage: string, current: number) {
    const stageData = this.stages.get(stage);
    if (!stageData) return;

    stageData.current = current;

    // Calculate overall progress
    let totalCurrent = 0;
    let totalMax = 0;
    for (const [_, data] of this.stages) {
      totalCurrent += data.current;
      totalMax += data.total;
    }

    const progress = totalMax > 0 ? totalCurrent / totalMax : 0;

    // Notify callbacks
    this.callbacks.forEach(cb => cb(progress, stage));
  }

  /**
   * Register progress callback
   */
  onProgress(callback: (progress: number, stage: string) => void) {
    this.callbacks.push(callback);
  }

  /**
   * Reset all progress
   */
  reset() {
    for (const [_, data] of this.stages) {
      data.current = 0;
    }
  }
}

/**
 * Simple retry mechanism for unreliable operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}
