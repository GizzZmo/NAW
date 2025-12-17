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

/**
 * Neural Engine version
 */
export const NEURAL_ENGINE_VERSION = '0.1.0-alpha';

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
    },
  };
}
