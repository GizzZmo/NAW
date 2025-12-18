/**
 * Neural Engine - Phase 2 Implementation
 * 
 * This module contains the neural audio generation pipeline
 * for the Neural Audio Workstation.
 * 
 * Architecture:
 * 1. DAC Codec: Compress/decompress audio to/from latent space
 * 2. Semantic Planner: Generate coarse musical structure (AR Transformer)
 * 3. Acoustic Renderer: Paint high-fidelity audio (Flow Matching)
 * 
 * @see ROADMAP.md § Phase 2
 */

// Codec exports
export {
  DACCodec,
  type DACConfig,
  type DACLatent,
  DEFAULT_DAC_CONFIG,
  encodeStems,
  decodeStems,
} from './codec/DACCodec';

// Planner exports
export {
  SemanticPlanner,
  type SemanticPlannerConfig,
  type SemanticPrompt,
  type SemanticSkeleton,
  DEFAULT_PLANNER_CONFIG,
  skeletonToLatent,
} from './planner/SemanticPlanner';

// Renderer exports
export {
  AcousticRenderer,
  type AcousticRendererConfig,
  type RenderPrompt,
  type RenderProgress,
  DEFAULT_RENDERER_CONFIG,
  generateMusic,
  type MusicGenerationPrompt,
} from './renderer/AcousticRenderer';

// ControlNet exports
export {
  ControlNet,
  type ControlNetConfig,
  type ControlSignal,
  ControlType,
  DEFAULT_CONTROLNET_CONFIG,
  type StyleAdapter,
  STYLE_ADAPTERS,
  loadStyleAdapter,
} from './control/ControlNet';

// CLAP exports
export {
  CLAP,
  type CLAPConfig,
  type AudioEmbedding,
  type TextEmbedding,
  DEFAULT_CLAP_CONFIG,
  MUSIC_STYLE_TAGS,
} from './conditioning/CLAP';

// Inpainting exports
export {
  SpectrogramInpainter,
  type InpaintingConfig,
  type InpaintingMask,
  type InpaintingResult,
  InpaintingMethod,
  DEFAULT_INPAINTING_CONFIG,
  quickInpaint,
} from './inpainting/SpectrogramInpainter';

// Vocoder exports
export {
  Vocoder,
  type VocoderConfig,
  type VocoderResult,
  VocoderType,
  DEFAULT_VOCODER_CONFIG,
  quickDecode,
  decodeMix,
} from './vocoder/Vocoder';

/**
 * Neural Engine version
 */
export const NEURAL_ENGINE_VERSION = '0.2.0-alpha';

// Utility exports
export {
  type QualityPreset,
  getQualityPresetConfig,
  createPipeline,
  estimateGenerationTime,
  formatTime,
  samplesToSeconds,
  secondsToSamples,
  barsToSamples,
  samplesToBars,
  normalizeAudio,
  applyFades,
  mixAudio,
  calculateRMS,
  calculatePeakDB,
  ProgressTracker,
  retry,
  type TimeEstimate,
} from './utils/helpers';

/**
 * Check if neural engine is ready for use
 * 
 * Currently returns false as Phase 2 is in development.
 * Will return true once all components are implemented.
 */
export function isNeuralEngineReady(): boolean {
  return false; // TODO: Implement in Phase 2
}

/**
 * Get neural engine status
 */
export interface NeuralEngineStatus {
  version: string;
  ready: boolean;
  components: {
    codec: boolean;
    planner: boolean;
    renderer: boolean;
    controlNet: boolean;
    clap: boolean;
    inpainting: boolean;
    vocoder: boolean;
  };
}

/**
 * Get current status of neural engine components
 */
export function getNeuralEngineStatus(): NeuralEngineStatus {
  return {
    version: NEURAL_ENGINE_VERSION,
    ready: false,
    components: {
      codec: false, // DAC not yet implemented
      planner: false, // Transformer-XL not yet implemented
      renderer: false, // Flow Matching not yet implemented
      controlNet: false, // ControlNet adapters not yet implemented
      clap: false, // CLAP model not yet implemented
      inpainting: false, // Inpainting diffusion not yet implemented
      vocoder: false, // Vocoder not yet implemented
    },
  };
}
