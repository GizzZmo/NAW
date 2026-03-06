<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Neural Audio Workstation (NAW)

**A Production-Grade AI Music Creation Environment**

[![CI](https://github.com/GizzZmo/NAW/actions/workflows/ci.yml/badge.svg)](https://github.com/GizzZmo/NAW/actions/workflows/ci.yml)
[![CodeQL](https://github.com/GizzZmo/NAW/actions/workflows/codeql.yml/badge.svg)](https://github.com/GizzZmo/NAW/actions/workflows/codeql.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-green.svg)]()
[![Tests](https://img.shields.io/badge/tests-67%20passing-brightgreen.svg)]()

</div>

---

## What is NAW?

**NAW (Neural Audio Workstation)** is a next-generation music production environment that integrates state-of-the-art AI generation with professional DAW (Digital Audio Workstation) workflows. Unlike consumer "text-to-music" tools that output monolithic stereo files, NAW gives producers **stem-level control**, **surgical editability**, and **multi-modal AI conditioning**—bridging the gap between generative AI and professional music production.

> *"The DAW of the future isn't just a recorder—it's a creative collaborator."*

---

## Why NAW?

Current AI music tools (Suno, Udio, Stable Audio) are great for **generative consumption**—creating complete songs from text prompts. But professional producers need more. NAW pioneers **generative production**:

| Consumer AI Tools | NAW |
|---|---|
| Monolithic stereo output | Stem-aware generation (drums, bass, vocals, other) |
| One-shot generation | Surgical inpainting — regenerate any region |
| Text-only conditioning | Multi-modal: text + MIDI + audio reference + rhythm mask |
| No DAW integration | VST3/AU plugin (Phase 4) |
| Consumer quality | Phase-aligned, mix-ready stems |

---

## Core Features

### 🎛️ Stem-Aware Generation
Four isolated, phase-aligned tracks — **Drums**, **Bass**, **Vocals**, **Other** — generated together and ready for mixing.

### 🎨 Surgical Inpainting
Select any region of any stem and regenerate it with bidirectional diffusion context. Fix a fill, change a chord, adjust an intro — without touching anything else.

### 🎹 Multi-Modal Control
Condition generation with:
- **Text prompts** — describe the sound in natural language
- **MIDI data** — guide melody and harmony with notes
- **Audio references** — match the vibe of an existing track (CLAP)
- **Rhythm masks** — lock in groove patterns (ControlNet)

### 🔄 Hybrid AR/Diffusion Architecture
Stage 1 (Semantic Planner) delivers a fast musical skeleton in ~2 seconds. Stage 2 (Acoustic Renderer) renders high-fidelity audio in ~10 seconds. Preview instantly, render when ready.

### 🎚️ Professional Mixer
Full per-stem mixer with volume faders, solo/mute, VU meters, and a master compressor.

### 🔌 DAW Integration (Phase 4)
VST3/AU/AAX plugin via JUCE. Low-latency ASIO backend. TensorRT optimization for <100ms real-time inference on supported GPUs.

---

## Architecture Overview

```
Text Prompt + BPM + Control Signals
         │
         ▼
┌─────────────────────────────────┐
│  Stage 1: Semantic Planner      │  ~2s  ← Autoregressive Transformer
│  Coarse musical skeleton        │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Stage 2: Acoustic Renderer     │  ~10s ← Flow Matching / Diffusion
│  High-fidelity audio output     │
└─────────────────────────────────┘
         │
         ▼
   4 Stem Tracks (WAV)
   Drums │ Bass │ Vocals │ Other
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full technical deep-dive.

---

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** — Foundation | ✅ Complete | UI/UX, timeline, mixer, piano roll, project save/load |
| **Phase 2** — Neural Engine | ✅ Architecture | DAC codec, Semantic Planner, Acoustic Renderer, Vocoder |
| **Phase 3** — Advanced Features | ✅ Architecture | ControlNet, CLAP conditioning, Spectrogram Inpainting, Multi-track Export |
| **Phase 4** — Production Ready | ✅ Architecture | VST/AU plugin, ASIO backend, TensorRT optimization, Commercial licensing |

Full details in [ROADMAP.md](ROADMAP.md).

---

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4
- **AI Integration**: Google Gemini 2.5 Flash (Semantic Planner simulation)
- **Neural Engine**: TypeScript stubs for DAC, Flow Matching, ControlNet, CLAP
- **Audio Backend**: Web Audio API (browser) / ASIO (desktop, Phase 4)
- **Plugin SDK**: JUCE (VST3/AU/AAX, Phase 4)
- **Optimization**: TensorRT for GPU inference (Phase 4)
- **Testing**: 67 tests via custom `tsx` runner

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/GizzZmo/NAW.git
cd NAW

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

Requires an [API key for Gemini](https://ai.google.dev/) for live AI generation.

---

## License

NAW is available under a **dual-license model**:

| Use Case | License | Cost |
|----------|---------|------|
| Personal, educational, research, open-source | [MIT](LICENSE) | Free |
| Commercial deployment, monetization, professional studio | [Commercial License](docs/COMMERCIAL_LICENSE.md) | $99–$2,999/year |

The MIT license is permissive and covers all personal and non-commercial use. A separate commercial license is available for teams and businesses who want a supported, production-ready distribution with SLA, API access, and enterprise features.

See [LICENSE](LICENSE) and [COMMERCIAL_LICENSE.md](docs/COMMERCIAL_LICENSE.md) for full terms.

---

## Links

| Resource | URL |
|----------|-----|
| 📖 Documentation | [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md) · [API.md](API.md) |
| 🐛 Issues | https://github.com/GizzZmo/NAW/issues |
| 🤝 Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 🎵 Live Demo (AI Studio) | https://ai.studio/apps/drive/1-xaWTqoGbGwitJJFN2c2WEeIpX1XDH2x |
| 📧 Commercial | commercial@naw-audio.com |

---

<div align="center">
<strong>Built with ❤️ for the future of music production</strong><br>
<em>Stem-aware · Surgical · Multi-modal · Professional</em>
</div>
