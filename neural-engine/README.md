# Neural Engine - Phase 2 Implementation

This directory contains the neural audio generation pipeline for NAW.

## 🏗️ Architecture

The neural engine implements a **two-stage hybrid pipeline**:

```
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: Semantic Planner (Autoregressive Transformer)     │
│  ─────────────────────────────────────────────────────────  │
│  Input:  Text Prompt + BPM + Control Signals                │
│  Output: Coarse Musical Skeleton (Structure, Rhythm, Pitch) │
│  Speed:  Fast (~2 seconds for 32 bars)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: Acoustic Renderer (Flow Matching / Diffusion)     │
│  ─────────────────────────────────────────────────────────  │
│  Input:  Semantic Skeleton + Text Prompt                    │
│  Output: High-Fidelity Audio with Realistic Timbre          │
│  Speed:  Slower (~10 seconds for 32 bars)                   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Structure

```
neural-engine/
├── index.ts                         # Main exports
├── codec/
│   └── DACCodec.ts                 # DAC audio codec
├── planner/
│   └── SemanticPlanner.ts          # Autoregressive planner
├── renderer/
│   └── AcousticRenderer.ts         # Flow matching renderer
├── vocoder/
│   └── Vocoder.ts                  # Audio reconstruction (Vocos/DisCoder/HiFiGAN)
├── control/
│   └── ControlNet.ts               # Fine-grained control adapters
├── conditioning/
│   └── CLAP.ts                     # Audio-text conditioning
└── inpainting/
    └── SpectrogramInpainter.ts     # Surgical audio editing
```

## 🚀 Usage

```typescript
import {
  DACCodec,
  SemanticPlanner,
  AcousticRenderer,
  Vocoder,
  VocoderType,
  generateMusic,
} from './neural-engine';

// Simple generation (recommended)
const stems = await generateMusic({
  text: "Uplifting house track",
  bpm: 128,
  bars: 32,
  quality: 'balanced', // 'fast' | 'balanced' | 'high'
});

// Advanced usage with components
const codec = new DACCodec();
const planner = new SemanticPlanner();
const renderer = new AcousticRenderer();
const vocoder = new Vocoder({ type: VocoderType.VOCOS });

await codec.initialize();
await planner.initialize();
await renderer.initialize();
await vocoder.initialize();

// Stage 1: Generate semantic skeleton
const skeleton = await planner.generate({
  text: "Energetic drum pattern",
  bpm: 140,
  bars: 16,
});

// Stage 2: Render acoustic details
const latents = await renderer.render({
  text: "Analog warm synth",
  semanticTokens: skeleton.tokens,
});

// Stage 3: Decode to audio with vocoder
const result = await vocoder.decode(latents[0]);
console.log(`Decoded ${result.audio.length} samples at ${result.rtf}x realtime`);
```

## 📋 Implementation Status

### Phase 2.1: Neural Audio Codec (April 2025)
- [x] DAC encoder implementation (stub)
- [x] DAC decoder implementation (stub)
- [x] RVQ quantization (stub)
- [x] Latent space visualization (stub)
- [ ] EnCodec compatibility layer
- [x] **Working test suite**

### Phase 2.2: Semantic Planner (May 2025)
- [x] Transformer-XL architecture (stub)
- [x] Multi-stream prediction (stub)
- [ ] Training data pipeline
- [ ] ONNX export and INT8 quantization
- [ ] Alternative: Mamba-based planner
- [x] **Working test suite**

### Phase 2.3: Acoustic Renderer (June 2025)
- [x] Flow Matching architecture (stub)
- [x] DiT backbone implementation (stub)
- [x] CLAP text conditioning (stub)
- [x] Classifier-free guidance (stub)
- [x] Vocoder integration (Vocos/DisCoder/HiFiGAN) - **Architecture complete**
- [ ] TensorRT optimization
- [x] **Working test suite**

### Phase 2.4: Full Pipeline Integration (Complete)
- [x] Vocoder module (Vocos/DisCoder/HiFiGAN)
- [x] generateMusic() end-to-end pipeline
- [x] Multi-vocoder support with quality presets
- [x] Stem mixing and normalization
- [x] Real-time factor reporting
- [x] **Complete test coverage**

### Phase 3: Advanced Features (Architecture Complete)
- [x] ControlNet adapters for fine-grained control
- [x] CLAP audio-text conditioning
- [x] Spectrogram inpainting
- [x] Style adapters (LoRA-based)
- [x] **Working test suite**

## 🧪 Testing

### Run Tests

```bash
npm test                  # Basic tests (53 tests)
npm run test:integration  # Integration tests (25 tests)
```

The test suite validates:
- Component initialization
- Configuration management
- Encoding/decoding pipeline
- Semantic planning
- Acoustic rendering
- Vocoder decoding and mixing
- ControlNet, CLAP, and Inpainting
- End-to-end pipeline with generateMusic()

### Run Demo

```bash
npm run demo
```

The demo shows:
- Full three-stage pipeline in action
- Semantic Planning → Acoustic Rendering → Vocoding
- Progress reporting
- Stem generation with vocoder
- Full pipeline using generateMusic()
- Real-time factor measurements

All tests currently pass with stub implementations. Real neural models will be integrated progressively.

## 🔬 Research References

### Neural Audio Codecs
- **DAC**: [Descript Audio Codec](https://github.com/descriptinc/descript-audio-codec)
- **EnCodec**: [High Fidelity Neural Audio Compression](https://github.com/facebookresearch/encodec)

### Semantic Planning
- **MusicGen**: [Simple and Controllable Music Generation](https://arxiv.org/abs/2306.05284)
- **Transformer-XL**: [Attentive Language Models Beyond a Fixed-Length Context](https://arxiv.org/abs/1901.02860)

### Acoustic Rendering
- **Flow Matching**: [Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747)
- **Stable Audio**: [Fast Timing-Conditioned Latent Audio Diffusion](https://arxiv.org/abs/2402.04825)

## 📚 API Reference

### Core Components

#### DACCodec

Compresses and decompresses audio to/from latent space using Residual Vector Quantization (RVQ).

```typescript
class DACCodec {
  constructor(config?: Partial<DACConfig>)
  
  // Initialize the codec (loads model weights)
  async initialize(): Promise<void>
  
  // Encode audio to latent tokens
  async encode(audio: Float32Array): Promise<DACLatent>
  
  // Decode latent tokens back to audio
  async decode(latent: DACLatent): Promise<Float32Array>
  
  // Extract semantic tokens (first 2 codebooks)
  extractSemanticTokens(latent: DACLatent): number[][]
  
  // Extract acoustic tokens (remaining codebooks)
  extractAcousticTokens(latent: DACLatent): number[][]
}
```

**Configuration Options:**
```typescript
interface DACConfig {
  sampleRate: number;        // Audio sample rate (default: 44100 Hz)
  latentRate: number;        // Latent representation rate (default: 24000 Hz)
  numCodebooks: number;      // Number of RVQ codebooks (default: 16)
  codebookSize: number;      // Size of each codebook (default: 1024)
  semanticCodebooks: number; // Semantic codebooks count (default: 2)
}
```

#### SemanticPlanner

Generates coarse musical structure using an autoregressive transformer.

```typescript
class SemanticPlanner {
  constructor(config?: Partial<SemanticPlannerConfig>)
  
  // Initialize the planner (loads model weights)
  async initialize(): Promise<void>
  
  // Generate semantic skeleton from prompt
  async generate(
    prompt: SemanticPrompt,
    onProgress?: (progress: number) => void
  ): Promise<SemanticSkeleton>
  
  // Set temperature for randomness control
  setTemperature(temperature: number): void
}
```

**Configuration Options:**
```typescript
interface SemanticPlannerConfig {
  modelSize: 'small' | 'medium' | 'large';
  contextWindow: number;        // Token context length (default: 2048)
  temperature: number;          // Sampling temperature (default: 0.8)
  topK: number;                // Top-K sampling (default: 50)
  topP: number;                // Nucleus sampling (default: 0.95)
  useKVCache: boolean;         // Enable KV-cache for speed (default: true)
}
```

#### AcousticRenderer

Renders high-fidelity audio from semantic tokens using flow matching.

```typescript
class AcousticRenderer {
  constructor(config?: Partial<AcousticRendererConfig>)
  
  // Initialize the renderer (loads model weights)
  async initialize(): Promise<void>
  
  // Render audio from semantic tokens
  async render(
    prompt: RenderPrompt,
    onProgress?: (progress: RenderProgress) => void
  ): Promise<DACLatent[]>
  
  // Set guidance scale for text conditioning
  setGuidanceScale(scale: number): void
  
  // Set quality preset
  setQualityPreset(preset: 'fast' | 'balanced' | 'high'): void
}
```

**Configuration Options:**
```typescript
interface AcousticRendererConfig {
  qualityPreset: 'fast' | 'balanced' | 'high';
  numSteps: number;            // Diffusion steps (default: 20)
  guidanceScale: number;       // CFG guidance strength (default: 3.0)
  modelSize: 'base' | 'large'; // Model size
  useVocoder: boolean;         // Use integrated vocoder (default: true)
  vocoderType: VocoderType;    // Vocoder backend
}
```

#### Vocoder

Converts latent representations to audio waveforms.

```typescript
class Vocoder {
  constructor(config?: Partial<VocoderConfig>)
  
  // Initialize the vocoder (loads model weights)
  async initialize(): Promise<void>
  
  // Decode latent to audio
  async decode(latent: DACLatent): Promise<VocoderResult>
  
  // Decode and mix multiple stems
  async decodeMix(
    latents: DACLatent[],
    volumes?: number[]
  ): Promise<VocoderResult>
}
```

**Vocoder Types:**
- `VocoderType.VOCOS`: Fast preview (25x realtime)
- `VocoderType.DISCODER`: High-quality final render
- `VocoderType.HIFIGAN`: Alternative for compatibility

### Advanced Features

#### ControlNet

Fine-grained control over generation using control signals.

```typescript
class ControlNet {
  constructor(config?: Partial<ControlNetConfig>)
  
  async initialize(): Promise<void>
  
  // Extract control signal from audio
  async extractControlSignal(
    audio: Float32Array,
    type: ControlType
  ): Promise<ControlSignal>
  
  // Apply control to latent
  async applyControl(
    latent: number[][],
    signal: ControlSignal,
    strength?: number
  ): Promise<number[][]>
  
  // Load style adapter (LoRA)
  async loadStyleAdapter(name: string): Promise<StyleAdapter>
}
```

**Control Types:**
- `ControlType.MELODY`: Melodic contour control
- `ControlType.RHYTHM`: Rhythmic pattern control
- `ControlType.DYNAMICS`: Loudness envelope control
- `ControlType.TIMBRE`: Spectral characteristics
- `ControlType.HARMONY`: Harmonic progression

#### CLAP

Audio-text contrastive conditioning for reference-based generation.

```typescript
class CLAP {
  constructor(config?: Partial<CLAPConfig>)
  
  async initialize(): Promise<void>
  
  // Encode audio to embedding
  async encodeAudio(audio: Float32Array): Promise<AudioEmbedding>
  
  // Encode text to embedding
  async encodeText(text: string): Promise<TextEmbedding>
  
  // Compute similarity between audio and text
  computeSimilarity(
    audioEmbed: AudioEmbedding,
    textEmbed: TextEmbedding
  ): number
  
  // Blend audio and text embeddings
  blendEmbeddings(
    audioEmbed: AudioEmbedding,
    textEmbed: TextEmbedding,
    audioWeight: number
  ): Float32Array
}
```

#### SpectrogramInpainter

Surgical audio editing through inpainting.

```typescript
class SpectrogramInpainter {
  constructor(config?: Partial<InpaintingConfig>)
  
  async initialize(): Promise<void>
  
  // Inpaint masked region
  async inpaint(
    audio: Float32Array,
    mask: InpaintingMask
  ): Promise<InpaintingResult>
  
  // Extend audio (outpainting)
  async outpaint(
    audio: Float32Array,
    extendSeconds: number,
    seamlessLoop?: boolean
  ): Promise<Float32Array>
  
  // Detect loop points
  async detectLoopPoints(
    audio: Float32Array
  ): Promise<Array<{ start: number; end: number; confidence: number }>>
}
```

## 💡 Advanced Usage Patterns

### Multi-Stem Generation with Different Styles

```typescript
import { generateMusic, loadStyleAdapter } from './neural-engine';

// Generate 4 stems with different style adapters per stem
const stems = await generateMusic({
  text: "Electronic music",
  bpm: 128,
  bars: 32,
  quality: 'balanced',
  stemStyles: {
    DRUMS: await loadStyleAdapter('techno'),
    BASS: await loadStyleAdapter('techno'),
    VOCALS: await loadStyleAdapter('jazz'),
    OTHER: await loadStyleAdapter('orchestral')
  }
});
```

### Reference-Based Generation with CLAP

```typescript
import { CLAP, generateMusic } from './neural-engine';

const clap = new CLAP();
await clap.initialize();

// Load reference audio
const referenceAudio = await loadAudioFile('reference.wav');
const audioEmbed = await clap.encodeAudio(referenceAudio);

// Generate with audio reference
const stems = await generateMusic({
  text: "Similar vibe but faster tempo",
  bpm: 140,
  bars: 32,
  audioReference: audioEmbed,
  audioReferenceWeight: 0.6 // 60% audio, 40% text
});
```

### Surgical Editing with Inpainting

```typescript
import { SpectrogramInpainter } from './neural-engine';

const inpainter = new SpectrogramInpainter();
await inpainter.initialize();

// Load audio
const audio = await loadAudioFile('track.wav');

// Define mask for region to regenerate (e.g., remove snare)
const mask: InpaintingMask = {
  startTime: 2.0,      // Start at 2 seconds
  endTime: 2.5,        // End at 2.5 seconds
  freqMin: 200,        // 200 Hz
  freqMax: 8000,       // 8000 Hz (snare frequency range)
};

// Inpaint the masked region
const result = await inpainter.inpaint(audio, mask);
console.log(`Inpainted ${result.inpaintedSamples} samples`);
```

### Custom Control with ControlNet

```typescript
import { ControlNet, ControlType, AcousticRenderer } from './neural-engine';

const controlNet = new ControlNet();
await controlNet.initialize();

const renderer = new AcousticRenderer();
await renderer.initialize();

// Extract melody from reference
const referenceMelody = await loadAudioFile('melody_reference.wav');
const melodySignal = await controlNet.extractControlSignal(
  referenceMelody,
  ControlType.MELODY
);

// Generate with melody control
const latents = await renderer.render({
  text: "Synthwave track",
  controlSignals: [melodySignal],
  controlStrength: 0.8
});
```

### Progressive Generation with Progress Tracking

```typescript
import { SemanticPlanner, AcousticRenderer, Vocoder } from './neural-engine';

const planner = new SemanticPlanner();
const renderer = new AcousticRenderer();
const vocoder = new Vocoder();

await Promise.all([
  planner.initialize(),
  renderer.initialize(),
  vocoder.initialize()
]);

// Stage 1: Semantic planning with progress
console.log('Stage 1: Semantic Planning...');
const skeleton = await planner.generate(
  { text: "Epic orchestral", bpm: 90, bars: 64 },
  (progress) => console.log(`Planning: ${Math.round(progress * 100)}%`)
);

// Stage 2: Acoustic rendering with progress
console.log('Stage 2: Acoustic Rendering...');
const latents = await renderer.render(
  { text: "Epic orchestral", semanticTokens: skeleton.tokens },
  (progress) => console.log(`Rendering: ${Math.round(progress.percentage)}%`)
);

// Stage 3: Vocoding
console.log('Stage 3: Vocoding...');
const audioResults = await Promise.all(
  latents.map(latent => vocoder.decode(latent))
);

console.log(`Generated ${audioResults.length} stems`);
audioResults.forEach((result, i) => {
  console.log(`Stem ${i}: ${result.rtf}x realtime`);
});
```

### Loop Generation with Outpainting

```typescript
import { SpectrogramInpainter } from './neural-engine';

const inpainter = new SpectrogramInpainter();
await inpainter.initialize();

// Load 8-bar loop
const loop = await loadAudioFile('8bar_loop.wav');

// Extend to 32 bars with seamless looping
const extended = await inpainter.outpaint(
  loop,
  24, // Extend by 24 bars (3x the original)
  true // Seamless loop
);

console.log(`Extended from 8 to 32 bars`);
```

## 🎯 Performance Considerations

### Memory Usage

- **DAC Codec**: ~500MB VRAM (encoder + decoder)
- **Semantic Planner**: ~1.5GB VRAM (500M params)
- **Acoustic Renderer**: ~4GB VRAM (1B params)
- **Total**: ~6GB VRAM minimum for full pipeline

### Latency Targets

| Component | Target Latency | Achieved (RTX 3090) |
|-----------|----------------|---------------------|
| DAC Encode | 10ms | TBD |
| Semantic Plan (1 bar) | 30ms | TBD |
| Acoustic Render (1 bar) | 50ms | TBD |
| Vocoding | 10ms | TBD |
| **Total (1 bar)** | **100ms** | **TBD** |

### Optimization Tips

1. **Use KV-Cache**: Enable in SemanticPlanner for 3-5x speedup
2. **Batch Processing**: Generate multiple stems in parallel
3. **Quality Presets**: Use 'fast' preset for iteration, 'high' for final render
4. **GPU Selection**: RTX 3090 or better recommended for real-time
5. **Quantization**: INT8 quantization provides 4x memory reduction with minimal quality loss

### Recommended Hardware

| Use Case | Minimum | Recommended | Optimal |
|----------|---------|-------------|---------|
| Preview | GTX 1660 (6GB) | RTX 3060 (12GB) | RTX 3090 (24GB) |
| Production | RTX 3060 (12GB) | RTX 3090 (24GB) | RTX 4090 (24GB) |
| Real-time | RTX 3090 (24GB) | RTX 4090 (24GB) | A100 (40GB) |

## 🐛 Troubleshooting

### Common Issues

**Issue**: "Model not found" error on initialization
```typescript
// Solution: Ensure model weights are downloaded
await downloadModels(); // Utility to download pre-trained weights
```

**Issue**: Out of memory during rendering
```typescript
// Solution: Use lower quality preset or smaller batch size
const renderer = new AcousticRenderer({
  qualityPreset: 'fast',  // Reduces VRAM usage
  modelSize: 'base'       // Use smaller model
});
```

**Issue**: Slow generation on CPU
```typescript
// Solution: Enable GPU acceleration
const vocoder = new Vocoder({
  useGPU: true,
  type: VocoderType.VOCOS // Fastest vocoder
});
```

**Issue**: Clicks/pops in generated audio
```typescript
// Solution: Use seamless loop mode or adjust fade settings
const inpainter = new SpectrogramInpainter({
  blendingMethod: 'smooth',
  fadeLength: 0.1 // 100ms fade
});
```

### Debug Mode

Enable verbose logging to diagnose issues:

```typescript
import { setDebugMode } from './neural-engine';

setDebugMode(true); // Enables detailed logging

// Now all operations will log detailed information
const stems = await generateMusic({ text: "Test", bpm: 120, bars: 8 });
```

## 🛠️ Development

Currently, this directory contains stub implementations with the correct interfaces
and architecture. Actual neural models will be integrated in Phase 2.

To add new features:
1. Follow the existing interface patterns
2. Add comprehensive JSDoc comments
3. Update this README
4. Add TODO comments for future implementation
5. Write tests before implementing real models
6. Document performance characteristics

### Contributing to Neural Engine

See [CONTRIBUTING.md](../CONTRIBUTING.md) for general guidelines. For neural-engine specific:

1. **Model Integration**: Follow the stub→implementation→optimization pattern
2. **Testing**: Add both unit tests and integration tests
3. **Documentation**: Update API reference and usage examples
4. **Benchmarking**: Include performance measurements on standard hardware

## 📞 Support

### Documentation
- [ROADMAP.md](../ROADMAP.md) - Development timeline
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Technical details
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guide
- [COMMERCIAL_LICENSE.md](../docs/COMMERCIAL_LICENSE.md) - Licensing information

### Community
- **Issues**: [GitHub Issues](https://github.com/GizzZmo/NAW/issues)
- **Discussions**: [GitHub Discussions](https://github.com/GizzZmo/NAW/discussions)

### Research Papers
For understanding the underlying algorithms and architectures, see the Research References section above and [ARCHITECTURE.md](../ARCHITECTURE.md).
