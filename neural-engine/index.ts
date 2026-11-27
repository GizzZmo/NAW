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

// ONNX inference scaffold (real model path — no weights shipped)
export {
  tryLoadOrt,
  loadOnnxSession,
  runOnnxInference,
  validateInferenceOutput,
  type OnnxSessionOptions,
  type OnnxInferenceResult,
} from './inference/onnxScaffold';

// Real text-to-music (MusicGen-small via Transformers.js)
export {
  generateWithMusicGen,
  generateMusicGenWav,
  type MusicGenOptions,
  type MusicGenResult,
} from './inference/musicgen';

/**
 * Neural Engine version
 */
export const NEURAL_ENGINE_VERSION = '0.2.0-alpha';

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
 * Check if neural engine is ready for production use.
 *
 * Returns false while components remain architecture + stubs.
 * Returns true only when real pretrained weights are loaded and
 * inference produces validated audio (see CAPABILITY_STATUS.md).
 */
export function isNeuralEngineReady(): boolean {
  return false;
}

/**
 * Get neural engine status
 */
export interface NeuralEngineStatus {
  version: string;
  ready: boolean;
  /** True only when a real pretrained model is loaded for that component. */
  components: {
    codec: boolean;
    planner: boolean;
    renderer: boolean;
    controlNet: boolean;
    clap: boolean;
    inpainting: boolean;
    vocoder: boolean;
  };
  notes: string;
}

/**
 * Get current status of neural engine components.
 * All components are currently stubs; none have pretrained weights.
 */
export function getNeuralEngineStatus(): NeuralEngineStatus {
  const components = {
    codec: false,
    planner: false,
    renderer: false,
    controlNet: false,
    clap: false,
    inpainting: false,
    vocoder: false,
  };

  return {
    version: NEURAL_ENGINE_VERSION,
    ready: false,
    components,
    notes: 'Architecture + stubs only. No pretrained weights loaded. See neural-engine/CAPABILITY_STATUS.md.',
  };
}
