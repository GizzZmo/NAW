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

## 🛠️ Development

Currently, this directory contains stub implementations with the correct interfaces
and architecture. Actual neural models will be integrated in Phase 2.

To add new features:
1. Follow the existing interface patterns
2. Add comprehensive JSDoc comments
3. Update this README
4. Add TODO comments for future implementation

## 📞 Support

See main repository documentation:
- [ROADMAP.md](../ROADMAP.md) - Development timeline
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Technical details
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guide
