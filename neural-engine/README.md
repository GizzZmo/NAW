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
├── index.ts                    # Main exports
├── codec/
│   └── DACCodec.ts            # DAC audio codec
├── planner/
│   └── SemanticPlanner.ts     # Autoregressive planner
└── renderer/
    └── AcousticRenderer.ts    # Flow matching renderer
```

## 🚀 Usage (Future)

```typescript
import {
  DACCodec,
  SemanticPlanner,
  AcousticRenderer,
  generateMusic,
} from './neural-engine';

// Simple generation
const stems = await generateMusic({
  text: "Uplifting house track",
  bpm: 128,
  bars: 32,
  quality: 'balanced',
});

// Advanced usage with components
const codec = new DACCodec();
const planner = new SemanticPlanner();
const renderer = new AcousticRenderer();

await codec.initialize();
await planner.initialize();
await renderer.initialize();

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

// Decode to audio
const audio = await codec.decode(latents[0]);
```

## 📋 Implementation Status

### Phase 2.1: Neural Audio Codec (April 2025)
- [ ] DAC encoder implementation
- [ ] DAC decoder implementation
- [ ] RVQ quantization
- [ ] Latent space visualization
- [ ] EnCodec compatibility layer

### Phase 2.2: Semantic Planner (May 2025)
- [ ] Transformer-XL architecture
- [ ] Multi-stream prediction
- [ ] Training data pipeline
- [ ] ONNX export and INT8 quantization
- [ ] Alternative: Mamba-based planner

### Phase 2.3: Acoustic Renderer (June 2025)
- [ ] Flow Matching architecture
- [ ] DiT backbone implementation
- [ ] CLAP text conditioning
- [ ] Classifier-free guidance
- [ ] TensorRT optimization
- [ ] Vocoder integration (Vocos/DisCoder)

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
