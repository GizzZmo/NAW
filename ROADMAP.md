# Neural Audio Workstation (NAW) - Development Roadmap

> **Technical and Product Roadmap for Next-Generation Music Production**

## Vision Statement

Transform the Neural Audio Workstation from a research prototype into a production-grade tool that bridges generative AI and professional music creation. Our goal is to enable artists to harness AI as a creative partner, not a replacement, through surgical control, stem-aware generation, and real-time inference.

---

## Phase 1: Foundation & Architecture (Q1 2025) ✅ CURRENT

**Status**: Completed  
**Goal**: Establish core architecture, UI/UX patterns, and semantic planning

### Completed Features
- ✅ **Hybrid Two-Stage Architecture Design**
  - Semantic Planner (Stage 1) using Gemini 2.5 Flash
  - Acoustic Renderer placeholder (Stage 2)
  - Simulation of AR → Diffusion pipeline

- ✅ **Stem-Aware Track System**
  - 4-stem architecture: DRUMS, BASS, VOCALS, OTHER
  - Independent volume, solo, mute controls
  - Phase-aligned generation (simulated)

- ✅ **Professional UI Components**
  - Timeline view with bar-based grid
  - Mixer view with channel strips
  - Transport controls (play, pause, stop)
  - BPM and bar position display

- ✅ **Dual Visualization Modes**
  - Spectrogram editor with brush tools
  - Piano roll for MIDI-style note display
  - Toggle between views per track

- ✅ **Prompt Timeline System**
  - Add prompt keyframes at any bar
  - Temporal style control (UI complete)
  - Prompt interpolation placeholder

- ✅ **Project Management**
  - Save/load projects as JSON
  - Preset system with example projects
  - State persistence

- ✅ **Audio Engine Simulation**
  - Web Audio API integration
  - Playback state management
  - Bar-accurate seeking

### Technical Debt
- Documentation gaps in component files
- No unit tests yet
- Limited error handling in generation flow

---

## Phase 2: Neural Engine Integration (Q2 2025) ✅ ARCHITECTURE COMPLETE

**Status**: Architecture Complete with Working Tests  
**Goal**: Replace simulation with real neural audio generation

### 2.1 Neural Audio Codec Layer (April 2025)

**Target**: Enable compression and reconstruction of audio to/from latent space

- [x] **DAC Architecture Design**
  - TypeScript interface definitions
  - Configuration system
  - Stub implementation with correct APIs
  - Working test suite and demo
  
- [ ] **DAC (Descript Audio Codec) Integration**
  - Research: Implement DAC encoder/decoder in TypeScript (or WASM)
  - 44.1kHz stereo, 24kHz latent rate
  - Residual Vector Quantization (RVQ) with 8-16 codebooks
  - Semantic-Acoustic split: First 2 codebooks = structure, remaining = texture

- [ ] **EnCodec Compatibility Layer**
  - Support loading legacy MusicGen checkpoints
  - Cross-codec format conversion utilities
  - Benchmark DAC vs EnCodec fidelity

- [ ] **Latent Space Visualization**
  - Display RVQ codebook indices in spectrogram view
  - Real-time latent channel display (8-16 streams)
  - Enable "Latent Editing" mode for advanced users

**Deliverable**: Audio can be encoded to discrete tokens and reconstructed with high fidelity  
**Current Status**: Architecture complete, stub implementation tested and working

---

### 2.2 Semantic Planner (AR Transformer) (May 2025)

**Target**: Generate coarse musical structure with long-term coherence

- [x] **Architecture Design**
  - TypeScript interface definitions
  - Configuration system with model sizes
  - Stub implementation with correct APIs
  - KV-cache architecture
  - Working test suite and demo

- [ ] **Model Architecture**
  - Deploy a lightweight Transformer-XL (300M-500M params)
  - Multi-stream prediction for 4 stems
  - Delay pattern for inter-stem conditioning
  - Context window: 2048 tokens (~2 minutes at 50Hz)

- [ ] **Training Data Pipeline**
  - Curate licensed music dataset (Epidemic Sound, Pond5)
  - Separate stems using Demucs HT
  - Tokenize with DAC codec (first 2 codebooks only)
  - Annotate with text prompts (manual + CLAP-based retrieval)

- [ ] **Inference Optimization**
  - ONNX export for cross-platform deployment
  - INT8 quantization for 4x size reduction
  - KV-cache for autoregressive speedup
  - Target: <2 seconds for 32 bars

- [ ] **Alternative: Mamba-based Planner**
  - Experiment with State Space Models for O(L) complexity
  - Compare quality/speed vs Transformer-XL

**Deliverable**: Generate structurally coherent 32-bar loops in 2 seconds  
**Current Status**: Architecture complete, stub implementation tested and working

---

### 2.3 Acoustic Renderer (Flow Matching) (June 2025)

**Target**: "Paint" high-fidelity audio onto the semantic skeleton

- [x] **Architecture Design**
  - TypeScript interface definitions
  - Configuration system with quality presets
  - Stub implementation with correct APIs
  - Progress callback architecture
  - Working test suite and demo

- [ ] **Model Architecture**
  - Conditional Flow Matching (CFM) on DAC latent space
  - DiT (Diffusion Transformer) backbone, ~1B params
  - Condition on: Semantic tokens + Text embedding (CLAP)
  - Refinement: Predict remaining 6-14 codebooks

- [ ] **Training Strategy**
  - Pre-train on coarse-to-fine reconstruction task
  - Fine-tune on text-conditioned generation
  - Classifier-free guidance for strong text adherence

- [ ] **Inference Optimization**
  - Reduce diffusion steps: 20 → 10 via distillation
  - TensorRT compilation for NVIDIA GPUs
  - Target: <10 seconds for 32 bars on RTX 3090

- [ ] **Vocoder Integration**
  - Vocos for real-time preview (<100ms latency)
  - DisCoder for high-quality final render
  - Switchable vocoder backend

**Deliverable**: Render 32-bar high-fidelity stems in <10 seconds  
**Current Status**: Architecture complete, stub implementation tested and working

---

## Phase 3: Advanced Control & Editing (Q3 2025)

**Status**: Planned  
**Goal**: Enable surgical editing, multi-modal conditioning, and professional workflows

### 3.1 ControlNet & Adapters (July 2025)

- [x] **ControlNet Architecture Design**
  - Zero-initialized encoder copy architecture
  - Control signal types (Melody, Rhythm, Dynamics, Timbre, Harmony)
  - Stub implementation with correct APIs
  
- [x] **Style Adapter Architecture**
  - LoRA adapter design (~85M params each)
  - Predefined style presets (Jazz, Techno, Orchestral, Lo-fi)
  - Adapter loading and swapping system

- [ ] **Music ControlNet Implementation**
  - Zero-initialized encoder copy
  - Conditioning signals: Melody curve, onset mask, dynamics envelope
  - Integration with both Stage 1 and Stage 2 models

- [ ] **MuseControlLite Adapters**
  - LoRA adapters for style transfer (~85M params each)
  - Presets: "Jazz", "Techno", "Orchestral", "Lo-fi"
  - User can load/swap adapters in real-time

- [x] **CLAP Audio Conditioning Architecture**
  - LAION CLAP model architecture
  - Audio and text encoding pipeline
  - Embedding blending system
  - Stub implementation with correct APIs

- [ ] **CLAP Audio Conditioning Implementation**
  - Integrate LAION CLAP model
  - "Style Slot": Drag audio file to condition generation
  - Extract and blend audio + text embeddings

- [ ] **UI Controls**
  - Style strength slider (0-100%)
  - Temperature slider for randomness
  - Adapter selector dropdown

**Deliverable**: Generate "a jazz bassline like this reference track at 128 BPM"

---

### 3.2 Spectrogram Inpainting (August 2025)

- [x] **Inpainting Architecture Design**
  - Discrete diffusion architecture
  - Similarity-guided diffusion design
  - Bidirectional context handling
  - Stub implementation with correct APIs

- [ ] **Discrete Diffusion for Inpainting**
  - Implement AIDD (Audio Inpainting via Discrete Diffusion)
  - Bidirectional context: Model sees past + future
  - Seamless boundary blending

- [ ] **Similarity-Guided Diffusion (SimDPS)**
  - Search track for structurally similar segments
  - Use as guidance for long-gap inpainting (>2 seconds)
  - Ensure motif consistency

- [ ] **Interactive UI**
  - Brush tool on spectrogram (already UI-ready)
  - Select region → Right-click → "Inpaint"
  - Real-time preview of inpainted region

- [x] **Outpainting Architecture**
  - Loop generation system design
  - Seamless loop point detection
  - Audio extension algorithm
  - Stub implementation with correct APIs

- [ ] **Outpainting for Loops**
  - Extend clip beyond end
  - Force seamless loop: End wraps to beginning
  - Auto-detect loop points

**Deliverable**: Paint on spectrogram to regenerate snare drum without affecting kick

---

### 3.3 Multi-Track Export & Stem Separation (September 2025)

- [x] **Multi-Track Export Architecture**
  - Individual WAV stem export
  - Stereo mixdown export
  - DAW project format support (Ableton, Logic, Pro Tools)
  - Stub implementation with correct APIs

- [ ] **Demucs Integration**
  - Bundle Hybrid Transformer Demucs (local inference)
  - Import MP3/WAV → Auto-separate to 4 stems
  - Place stems on timeline as clips

- [ ] **Export Formats Implementation**
  - Individual stem export: DRUMS.wav, BASS.wav, etc.
  - Stereo mixdown export
  - Project export with stems (Ableton/Logic compatible folder structure)

- [ ] **Stem Replacement Workflow**
  - Import song → Separate stems
  - Mute DRUMS → Generate new AI drums that match
  - Export final mix

**Deliverable**: Import any song, replace the drums with AI, export stems

---

## Phase 4: Real-Time Inference & Plugin (Q4 2025)

**Status**: Conceptual  
**Goal**: Run as a VST/AU plugin inside professional DAWs

### 4.1 JUCE Plugin Development (October 2025)

- [x] **VST/AU Plugin Architecture Documentation**
  - Complete plugin architecture design (JUCE)
  - Audio thread vs UI thread separation
  - Lookahead scheduling system
  - Parameter automation design
  - MIDI input handling
  - Preset management system

- [x] **ASIO Audio Backend Architecture**
  - Low-latency audio I/O design
  - Cross-platform backend support (ASIO, Core Audio, ALSA, JACK)
  - Real-time audio callback system
  - Stub implementation with correct APIs

- [ ] **VST3/AU Plugin Shell**
  - Build with JUCE C++ framework
  - Embed ONNX Runtime for model inference
  - Support for Windows, macOS, Linux

- [ ] **Asynchronous Lookahead**
  - Report 4-bar latency to DAW
  - Process audio in background thread
  - Buffer playback for seamless integration

- [ ] **Parameter Exposure**
  - DAW automation: Style strength, temperature
  - MIDI input for melody control
  - Sidechain input for rhythm extraction

- [ ] **Neutone SDK Integration**
  - Allow third-party models to be loaded as .neutone files
  - Platform for researchers to publish NAW-compatible models

**Deliverable**: Load NAW as a VST in Ableton, generate stems in real-time

---

### 4.2 Extreme Optimization (November 2025)

- [x] **TensorRT Optimization Configuration**
  - Precision modes (FP32, FP16, INT8, Mixed)
  - Optimization levels (O0-O3)
  - Performance presets (Real-time, Quality, Batch)
  - Model-specific optimizations (DAC, Planner, Renderer)
  - GPU performance profiles
  - INT8 calibration system
  - Latency budget breakdown (<100ms target)

- [ ] **Model Distillation**
  - Compress Stage 2 model: 1B → 500M params
  - Maintain 90%+ quality via knowledge distillation

- [ ] **INT8 & Mixed Precision**
  - Quantization-Aware Training (QAT)
  - Test on consumer GPUs (RTX 3060, Apple M2)

- [ ] **CUDA & Metal Acceleration**
  - TensorRT engines for NVIDIA
  - CoreML for Apple Silicon
  - Fallback to CPU with reduced quality

- [ ] **Benchmark Suite**
  - Target: 100ms latency for 1-bar generation
  - Test on GTX 1660, RTX 3090, M2 Max

**Deliverable**: Generate 1 bar of stems in <100ms on RTX 3090

---

### 4.3 Commercial Readiness (December 2025)

- [x] **Licensing Documentation**
  - Dual-license structure (MIT + Commercial)
  - Commercial license tiers (Individual, Professional, Enterprise)
  - AI model licensing compliance
  - "Fairly Trained" certification plan
  
- [x] **Architecture Documentation**
  - VST/AU plugin architecture (JUCE)
  - ASIO audio backend design
  - Multi-track export implementation
  - Real-time inference requirements (<100ms latency)

- [ ] **Watermarking & Safety**
  - Integrate Audioseal for imperceptible watermarks
  - Detect AI-generated audio
  - Artist opt-out mechanism

- [ ] **Cloud Rendering Service (Optional)**
  - For users without powerful GPUs
  - API endpoint: Send prompt → Receive stems
  - Pay-per-generation pricing

- [ ] **Beta Testing**
  - Closed beta with 100 professional producers
  - Collect feedback on latency, quality, UI/UX
  - Iterate on pain points

**Deliverable**: Commercially licensed, production-ready software with dual-license model

---

## Phase 5: Advanced Research & Future Vision (2026+)

**Status**: Exploration  
**Goal**: Push boundaries of AI-assisted music creation

### Potential Features

- **Real-Time Style Morphing**
  - RAVE-like ultra-low latency models (<10ms)
  - Beatbox input → Fully produced drums in real-time

- **Neuro-Symbolic Composition**
  - LLM outputs music theory (Roman numerals, chord progressions)
  - Guide audio generation with symbolic constraints
  - "Generate verse in C minor, then modulate to E♭ major for chorus"

- **Infinite Context Windows**
  - Ring Attention or advanced SSMs
  - Generate hour-long DJ sets with perfect coherence

- **Collaborative AI Jamming**
  - Multiplayer mode: AI responds to live input from multiple users
  - Reinforcement learning for "listening" to human players

- **Hardware Acceleration**
  - Custom ASIC or FPGA for neural audio processing
  - Embedded device: Standalone AI music box

---

## Success Metrics

### Technical KPIs
- **Latency**: <100ms for 1-bar generation (real-time threshold)
- **Fidelity**: >4.5 MUSHRA score (perceptual quality)
- **Controllability**: >90% adherence to user prompts (measured via CLAP similarity)
- **Coherence**: >0.85 structural similarity across long tracks

### Product KPIs
- **Adoption**: 10,000 active users by end of 2025
- **Engagement**: Average session length >30 minutes
- **Creation**: 1M stems generated per month
- **Conversion**: 10% of users upgrade to commercial license

---

## Dependencies & Risks

### Critical Dependencies
- **Compute Resources**: Access to A100/H100 GPUs for training
- **Data Licensing**: Secure rights to music dataset
- **Talent**: Hire ML engineers with audio expertise

### Technical Risks
- **Model Quality**: Flow Matching may not achieve target fidelity
  - *Mitigation*: Fallback to proven Latent Diffusion Models
- **Latency**: Real-time performance on consumer GPUs may be infeasible
  - *Mitigation*: Offer cloud rendering for underpowered devices
- **Copyright**: Legal challenges from rights holders
  - *Mitigation*: "Fairly Trained" certification, watermarking

### Market Risks
- **Competition**: Suno/Udio add stem export
  - *Mitigation*: Focus on surgical editing and DAW integration
- **Adoption**: Producers reject AI as "cheating"
  - *Mitigation*: Position as "AI-assisted" tool, not replacement

---

## Contributing to the Roadmap

This roadmap is a living document. Contributions are welcome!

**How to Influence Priorities:**
- 🐛 **Report Bugs**: Critical bugs move features up the timeline
- 💡 **Feature Requests**: High-demand features may be added to earlier phases
- 🔬 **Research**: Share relevant papers that could improve architecture
- 💻 **Code**: Submit PRs for items marked [ ] in current phase

**Discussion Channels:**
- GitHub Issues: https://github.com/GizzZmo/NAW/issues
- Discussions: https://github.com/GizzZmo/NAW/discussions

---

## Changelog

- **2025-01-15**: Roadmap created (Phase 1 complete, Phase 2-4 planned)
- **2025-12-16**: Phase 2 started - Neural engine architecture implemented
- **2025-12-17**: Phase 2 architecture completed with working tests and workflows
- **2025-12-17**: Phase 3 & 4 architectures completed:
  - ControlNet adapters and style transfer system
  - CLAP audio conditioning architecture
  - Spectrogram inpainting and outpainting system
  - Multi-track export functionality
  - ASIO audio backend design
  - VST/AU plugin architecture (JUCE)
  - TensorRT optimization configuration
  - Commercial licensing structure

---

**Last Updated**: December 17, 2025  
**Maintainer**: @GizzZmo  
**Status**: Phase 1 Complete ✅ | Phase 2 Architecture Complete ✅ | Phase 3 & 4 Architectures Complete ✅ | Implementation In Progress 🚧
