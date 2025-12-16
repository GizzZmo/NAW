<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Neural Audio Workstation (NAW)

> **A Production-Grade AI Music Creation Environment**  
> Bridging the gap between generative AI and professional music production

[![CI](https://github.com/GizzZmo/NAW/actions/workflows/ci.yml/badge.svg)](https://github.com/GizzZmo/NAW/actions/workflows/ci.yml)
[![CodeQL](https://github.com/GizzZmo/NAW/actions/workflows/codeql.yml/badge.svg)](https://github.com/GizzZmo/NAW/actions/workflows/codeql.yml)
[![Code Quality](https://github.com/GizzZmo/NAW/actions/workflows/code-quality.yml/badge.svg)](https://github.com/GizzZmo/NAW/actions/workflows/code-quality.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-green.svg)]()
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)]()

## 🎯 Overview

The Neural Audio Workstation (NAW) is a next-generation music production tool that integrates state-of-the-art AI generation with professional DAW workflows. Unlike consumer "text-to-music" tools that output monolithic stereo files, NAW provides **stem-aware generation**, **surgical editability**, and **multi-modal conditioning** for professional creators.

### The Paradigm Shift: From Generative Consumption to Generative Production

Current AI music tools (Suno, Udio, Stable Audio) excel at **generative consumption** - creating complete songs from text prompts. NAW pioneers **generative production**, offering:

- 🎛️ **Stem-Level Generation**: Isolated tracks (drums, bass, vocals, other) that are phase-aligned and mix-ready
- 🎨 **Surgical Inpainting**: Regenerate specific regions of audio using bidirectional diffusion
- 🎹 **Multi-Modal Control**: Text prompts, MIDI data, audio references, and rhythmic masks
- 🔄 **Real-Time Workflow**: Hybrid AR/Diffusion architecture for fast preview and high-quality rendering
- 🎚️ **Professional Mixing**: Full mixer view with per-stem volume, solo, and mute controls

## 🏗️ Architecture

NAW implements a **Hybrid "Compose-then-Render" Architecture** inspired by cutting-edge research:

### Two-Stage Pipeline

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

### Current Implementation Status

**✅ Implemented:**
- Semantic Planner using Gemini 2.5 Flash (simulates AR Transformer)
- Stem-aware track architecture (4-stem separation: DRUMS, BASS, VOCALS, OTHER)
- Spectrogram Editor with inpainting UI
- Piano Roll view for MIDI-style visualization
- Prompt Timeline for temporal style control
- Professional mixer with per-stem controls
- Project save/load (JSON format)
- Real-time playback simulation

**🚧 In Development (See [ROADMAP.md](ROADMAP.md)):**
- Neural Audio Codec integration (DAC/EnCodec)
- Actual Flow Matching renderer for Stage 2
- ControlNet adapters for fine-grained control
- Audio-based conditioning (CLAP embeddings)
- VST/AU plugin architecture (JUCE)

## 🎨 Key Features

### 1. Stem-Aware Generation
Generate music as **4 independent, synchronized stems** instead of a single stereo file:
- **Drums**: Kick, snare, hi-hats, percussion
- **Bass**: Sub-bass, bass guitar, bass synth
- **Vocals**: Lead vocals, harmonies, vocal effects
- **Other**: Melody, chords, atmosphere, FX

Each stem can be:
- Solo'd or muted independently
- Adjusted in volume
- Edited or regenerated separately
- Exported as individual WAV files

### 2. Spectrogram Inpainting
Paint directly on the **spectrogram** to mask regions for regeneration:
- **Brush Tool**: Mask specific frequency ranges or time regions
- **Bidirectional Context**: AI sees both past and future context for seamless edits
- **Latent Visualization**: Toggle view to see the model's internal representation

### 3. Prompt Timeline
Musical prompts that change over time:
```
Bar 1-8:   "Lo-fi vinyl crackle, mellow jazz piano"
Bar 9-16:  "Build tension, add strings"
Bar 17-24: "Drop, aggressive dubstep bass"
Bar 25-32: "Outro, fade to ambient"
```

### 4. Dual Visualization Modes
- **Spectrogram View**: Frequency-over-time representation for audio editing
- **Piano Roll View**: MIDI-style note grid for melodic/harmonic editing

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or later)
- **npm** or **yarn**
- **Gemini API Key** (for AI generation)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/GizzZmo/NAW.git
   cd NAW
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   Create a `.env.local` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```
   
   Get your API key from: https://ai.google.dev/

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## 📖 Usage Guide

### Basic Workflow

1. **Enter a Prompt**
   - In the left sidebar, type a musical prompt (e.g., "Uplifting house track, 128 BPM, energetic")
   - Click **"Generate Skeleton"**

2. **Review Generated Stems**
   - The timeline shows 4 tracks with generated patterns
   - Each track has clips containing musical events

3. **Adjust in Mixer**
   - Switch to **Mixer** view (top-right toggle)
   - Adjust volume, solo/mute individual stems
   - Monitor levels in real-time

4. **Edit with Spectrogram**
   - Switch back to **Timeline** view
   - Change visualization to **Spectrogram** mode
   - Use the **Brush Tool** to mask regions for inpainting (future feature)

5. **Add Prompt Keyframes**
   - Click anywhere on the timeline to add a style change
   - Enter a new prompt for that section

6. **Save/Load Projects**
   - Click **Download** icon to save project as JSON
   - Click **Upload** icon to load a saved project
   - Browse **Presets** for example projects

## 🎼 Technical Stack

### Frontend
- **React 19** - UI framework with hooks and modern patterns
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling (via inline classes)
- **Lucide React** - Icon library

### AI/ML
- **Gemini 2.5 Flash** - Semantic planner (simulates AR Transformer)
- **Planned**: DAC/EnCodec for neural audio codec
- **Planned**: Flow Matching for acoustic rendering
- **Planned**: ControlNet for fine-grained control

### Audio Processing
- **Web Audio API** - Browser-native audio synthesis (current simulation)
- **Planned**: TensorRT/ONNX for optimized inference
- **Planned**: JUCE framework for VST/AU plugin

## 🔬 Theoretical Foundations

NAW's architecture is based on state-of-the-art research:

### Autoregressive Models (Stage 1)
- **MusicGen** (Meta): Multi-stream transformer for music generation
- **Fish Speech 4**: DualAR architecture for better prosody modeling
- **Transformer-XL**: Recurrent attention for long-context coherence

### Diffusion Models (Stage 2)
- **Stable Audio Open**: Latent diffusion conditioned on text
- **Flow Matching**: Faster convergence than standard diffusion
- **AudioLDM**: Diffusion in compressed latent space

### Neural Audio Codecs
- **DAC** (Descript): 44.1kHz stereo, superior fidelity
- **EnCodec** (Meta): Residual Vector Quantization (RVQ)
- **AudioDec**: Ultra-low latency streaming codec

### Control & Editing
- **ControlNet**: Zero-initialized adapters for conditioned generation
- **MuseControlLite**: Parameter-efficient fine-tuning (PEFT)
- **CLAP**: Contrastive Language-Audio Pretraining for audio reference
- **Discrete Diffusion**: Bidirectional inpainting for surgical edits

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical documentation.

## 📋 Roadmap

### Phase 1: Foundation (Q1 2025) ✅
- [x] Core UI and timeline
- [x] Stem-aware architecture
- [x] Semantic planner integration
- [x] Basic playback simulation
- [x] Project save/load

### Phase 2: Neural Engine (Current - Q2 2025) 🚧
- [x] Architecture design and stubs
- [ ] Integrate DAC audio codec
- [ ] Implement Flow Matching renderer
- [ ] Add ControlNet adapters
- [ ] Real audio generation (not simulation)

### Phase 3: Advanced Features (Q3 2025)
- [ ] Spectrogram inpainting (actual implementation)
- [ ] CLAP-based audio conditioning
- [ ] Outpainting for loop generation
- [ ] Multi-track export

### Phase 4: Production Ready (Q4 2025)
- [ ] VST/AU plugin (JUCE)
- [ ] TensorRT optimization
- [ ] Real-time inference (<100ms latency)
- [ ] Commercial licensing

See [ROADMAP.md](ROADMAP.md) for complete details.

## 🤝 Contributing

Contributions are welcome! This project is in active development.

**Areas of Interest:**
- Neural audio codec integration
- Flow matching implementation
- ControlNet adapters for music
- VST/AU plugin development
- Documentation and examples

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

**Note on AI Model Licensing:**
- The current Gemini integration is for research/prototyping
- Future neural models must use permissive licenses (Apache 2.0, MIT) for commercial use
- Models like MusicGen (CC-BY-NC) require commercial licensing from Meta

## 🙏 Acknowledgments

This project is inspired by cutting-edge research from:
- **Meta AI** (MusicGen, EnCodec)
- **Stability AI** (Stable Audio)
- **Descript** (DAC Codec)
- **Google Research** (Flow Matching, Gemini)

Special thanks to the open-source audio ML community.

## 📞 Contact & Links

- **Repository**: https://github.com/GizzZmo/NAW
- **Issues**: https://github.com/GizzZmo/NAW/issues
- **AI Studio**: https://ai.studio/apps/drive/1-xaWTqoGbGwitJJFN2c2WEeIpX1XDH2x
- **Documentation**: [ARCHITECTURE.md](ARCHITECTURE.md) | [ROADMAP.md](ROADMAP.md)

---

**Built with ❤️ for the future of music production**
