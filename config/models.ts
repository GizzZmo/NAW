/**
 * @fileoverview Neural Model Configuration
 * 
 * This file contains placeholder configurations for future neural model integration.
 * These settings will be used when the full NAW neural pipeline is implemented
 * (DAC codec, Transformer-XL planner, Flow Matching renderer).
 * 
 * @module config/models
 */

/**
 * Neural Audio Codec Configuration
 * 
 * Settings for the DAC (Descript Audio Codec) or EnCodec layer.
 * This is the foundation of the entire system - all audio passes through the codec.
 */
export const CODEC_CONFIG = {
  /** 
   * Codec type selection
   * - 'DAC': Descript Audio Codec (recommended, best quality)
   * - 'EnCodec': Meta's EnCodec (for legacy MusicGen compatibility)
   */
  type: 'DAC' as 'DAC' | 'EnCodec',
  
  /** Audio sample rate in Hz */
  sampleRate: 44100,
  
  /** Number of audio channels (1 = mono, 2 = stereo) */
  channels: 2,
  
  /** 
   * Latent frame rate (frames per second)
   * - DAC default: 24000 / 512 ≈ 46.875 Hz
   * - EnCodec: 75 Hz
   */
  latentRate: 24000 / 512,
  
  /** 
   * Number of Residual Vector Quantization (RVQ) codebooks
   * - More codebooks = higher fidelity, slower processing
   * - Typical range: 8-16 for music, 4-8 for speech
   */
  numCodebooks: 16,
  
  /** 
   * Codebook size (vocabulary size per codebook)
   * - DAC: 1024 (10 bits per token)
   * - EnCodec: 2048 (11 bits per token)
   */
  codebookSize: 1024,
  
  /** 
   * Semantic-Acoustic split point
   * - First N codebooks capture semantic info (pitch, rhythm)
   * - Remaining codebooks capture acoustic details (timbre, noise)
   * - This enables the hybrid AR + Diffusion architecture
   */
  semanticCodebooks: 2,
  
  /** 
   * Latent dimension (size of continuous vector before quantization)
   */
  latentDim: 256,
  
  /** 
   * Model checkpoint path (future: load .pth file)
   */
  checkpointPath: 'models/codec/dac_44khz.pth',
};

/**
 * Semantic Planner (Stage 1) Configuration
 * 
 * Settings for the Autoregressive Transformer that generates musical structure.
 */
export const SEMANTIC_PLANNER_CONFIG = {
  /** 
   * Model architecture
   * - 'TransformerXL': Recurrent attention for long context
   * - 'Mamba': State space model (experimental, O(L) complexity)
   */
  architecture: 'TransformerXL' as 'TransformerXL' | 'Mamba',
  
  /** Number of parameters (300M-500M recommended) */
  numParams: 500e6,
  
  /** 
   * Context length in tokens
   * - At 50Hz latent rate, 2048 tokens ≈ 40 seconds
   * - Longer context = better coherence, more memory
   */
  contextLength: 2048,
  
  /** Number of transformer layers */
  numLayers: 24,
  
  /** Dimension of each layer */
  dim: 1024,
  
  /** Number of attention heads */
  numHeads: 16,
  
  /** 
   * Multi-stream configuration for 4-stem generation
   * - Enables parallel generation of DRUMS, BASS, VOCALS, OTHER
   */
  numStreams: 4,
  
  /** 
   * Delay pattern for inter-stream conditioning
   * - Example: [0, 1, 1, 2] means BASS is 1 step ahead of DRUMS
   * - Allows melody to react to bass/drums in real-time
   */
  delayPattern: [0, 1, 1, 2],
  
  /** 
   * Sampling temperature (0.0-1.5)
   * - Lower = more deterministic, repetitive
   * - Higher = more random, creative
   */
  temperature: 0.9,
  
  /** 
   * Top-K filtering (limit to K most likely tokens)
   * - 0 = disabled
   * - 50-200 typical range
   */
  topK: 100,
  
  /** 
   * Top-P (nucleus) sampling
   * - Only sample from tokens comprising top P cumulative probability
   * - 0.9-0.95 typical range
   */
  topP: 0.95,
  
  /** Model checkpoint path */
  checkpointPath: 'models/planner/transformer_xl_500m.pth',
};

/**
 * Acoustic Renderer (Stage 2) Configuration
 * 
 * Settings for the Flow Matching model that "paints" high-fidelity audio.
 */
export const ACOUSTIC_RENDERER_CONFIG = {
  /** 
   * Model architecture
   * - 'FlowMatching': Continuous normalizing flow (recommended)
   * - 'LatentDiffusion': Standard DDPM/DDIM diffusion
   */
  architecture: 'FlowMatching' as 'FlowMatching' | 'LatentDiffusion',
  
  /** Number of parameters (1B recommended for quality) */
  numParams: 1e9,
  
  /** 
   * Number of denoising steps
   * - More steps = better quality, slower
   * - 50 for training, 10-20 for inference (after distillation)
   */
  numSteps: 10,
  
  /** 
   * Classifier-free guidance scale
   * - 0 = no guidance (random)
   * - 7-15 typical for strong text adherence
   */
  guidanceScale: 10.0,
  
  /** 
   * DiT (Diffusion Transformer) configuration
   */
  dit: {
    numLayers: 32,
    dim: 1280,
    numHeads: 20,
    patchSize: 2,
  },
  
  /** 
   * Conditioning type
   * - 'CLAP': Contrastive Language-Audio Pretraining (text + audio)
   * - 'T5': Text-only (T5 embeddings)
   */
  conditioningType: 'CLAP' as 'CLAP' | 'T5',
  
  /** Model checkpoint path */
  checkpointPath: 'models/renderer/flow_matching_1b.pth',
};

/**
 * Neural Vocoder Configuration
 * 
 * Settings for converting latent tokens back to audio waveforms.
 */
export const VOCODER_CONFIG = {
  /** 
   * Active vocoder for rendering
   * - 'Vocos': Fast preview mode (<100ms latency)
   * - 'DisCoder': High-quality final render (44.1kHz, best phase)
   * - 'HiFi-GAN': Alternative high-quality option
   */
  activeVocoder: 'Vocos' as 'Vocos' | 'DisCoder' | 'HiFi-GAN',
  
  /** Vocos configuration */
  vocos: {
    checkpointPath: 'models/vocoder/vocos_24khz.pth',
    upsampleFactor: 240, // 24kHz → 44.1kHz
  },
  
  /** DisCoder configuration */
  discoder: {
    checkpointPath: 'models/vocoder/discoder_dac.pth',
    numFilters: 32,
  },
  
  /** HiFi-GAN configuration */
  hifiGan: {
    checkpointPath: 'models/vocoder/hifigan_universal.pth',
    multiPeriodDiscriminator: true,
  },
};

/**
 * ControlNet Adapter Configuration
 * 
 * Settings for fine-grained control mechanisms.
 */
export const CONTROLNET_CONFIG = {
  /** Enable ControlNet during generation */
  enabled: false,
  
  /** 
   * Available control types
   * - 'melody': Pitch curve control
   * - 'rhythm': Onset mask control
   * - 'dynamics': Volume envelope control
   */
  availableControls: ['melody', 'rhythm', 'dynamics'] as const,
  
  /** 
   * Zero-convolution initialization
   * - Ensures ControlNet starts with no effect, gradually learns control
   */
  zeroInit: true,
  
  /** 
   * Control strength (0.0-1.0)
   * - 0.0 = no control (ignore control signal)
   * - 1.0 = full control (strictly follow signal)
   */
  strength: 0.8,
  
  /** Model checkpoint path */
  checkpointPath: 'models/controlnet/music_controlnet.pth',
};

/**
 * LoRA Adapter Configuration
 * 
 * Settings for style adaptation via Low-Rank Adaptation.
 */
export const LORA_CONFIG = {
  /** Available style adapters */
  adapters: {
    jazz: {
      path: 'models/lora/jazz_adapter.pth',
      description: 'Swing feel, complex harmony, walking bass',
      rank: 64,
    },
    techno: {
      path: 'models/lora/techno_adapter.pth',
      description: 'Driving 4/4, minimal harmony, saw bass',
      rank: 64,
    },
    lofi: {
      path: 'models/lora/lofi_adapter.pth',
      description: 'Vinyl crackle, mellow chords, tape warble',
      rank: 64,
    },
    orchestral: {
      path: 'models/lora/orchestral_adapter.pth',
      description: 'String ensembles, brass, cinematic',
      rank: 64,
    },
  },
  
  /** 
   * Active adapter (null = base model, no style)
   */
  activeAdapter: null as keyof typeof LORA_CONFIG.adapters | null,
  
  /** 
   * Adapter strength (0.0-1.0)
   * - 0.0 = base model only
   * - 1.0 = full adapter influence
   */
  strength: 1.0,
};

/**
 * Inference Optimization Configuration
 * 
 * Settings for performance tuning.
 */
export const OPTIMIZATION_CONFIG = {
  /** 
   * Quantization mode
   * - 'FP32': Full precision (slowest, highest quality)
   * - 'FP16': Half precision (2x faster, minimal quality loss)
   * - 'INT8': 8-bit quantization (4x faster, requires QAT)
   */
  quantization: 'FP16' as 'FP32' | 'FP16' | 'INT8',
  
  /** 
   * Device selection
   * - 'cuda': NVIDIA GPU (fastest with TensorRT)
   * - 'mps': Apple Metal (M1/M2 Macs)
   * - 'cpu': CPU fallback (slow)
   */
  device: 'cuda' as 'cuda' | 'mps' | 'cpu',
  
  /** 
   * Batch size for inference
   * - Larger = better GPU utilization, more memory
   * - Typical: 1-4 for realtime, 8-16 for offline
   */
  batchSize: 1,
  
  /** 
   * KV-cache for autoregressive models
   * - Caches key/value tensors to speed up sequential generation
   */
  useKVCache: true,
  
  /** 
   * Compile model with TensorRT (NVIDIA only)
   */
  useTensorRT: false,
  
  /** 
   * Async generation (non-blocking UI)
   */
  async: true,
};

/**
 * Watermarking Configuration
 * 
 * Settings for audio watermarking (transparency, copyright).
 */
export const WATERMARK_CONFIG = {
  /** Enable watermarking */
  enabled: false,
  
  /** 
   * Watermarking method
   * - 'Audioseal': Meta's imperceptible watermark
   */
  method: 'Audioseal' as 'Audioseal',
  
  /** 
   * Watermark payload (embedded data)
   * - Could include: timestamp, user ID, model version
   */
  payload: 'NAW-v1.1.0',
  
  /** 
   * Robustness vs imperceptibility tradeoff
   * - Higher = more robust to attacks, more audible
   */
  strength: 0.5,
};

/**
 * Combined model configuration export
 */
export const MODEL_CONFIG = {
  codec: CODEC_CONFIG,
  semanticPlanner: SEMANTIC_PLANNER_CONFIG,
  acousticRenderer: ACOUSTIC_RENDERER_CONFIG,
  vocoder: VOCODER_CONFIG,
  controlnet: CONTROLNET_CONFIG,
  lora: LORA_CONFIG,
  optimization: OPTIMIZATION_CONFIG,
  watermark: WATERMARK_CONFIG,
};

export default MODEL_CONFIG;
