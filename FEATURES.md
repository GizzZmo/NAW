# NAW Features Documentation

> **Current Implementation Status (v1.8) and Future Feature Roadmap**

## 🚀 v1.8 Features (Current)

### Multi-Agent Symbolic Generation
- ✅ Sidebar AI Agent panel (Gemini, OpenAI, Grok, Anthropic, OpenRouter)
- ✅ User API keys stored in localStorage; sent with each request
- ✅ Provider-specific key validation (prefixes, length, no spaces)
- ✅ Server env-var fallbacks (`GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.)
- ✅ Style Adapters, Strength, Temperature, per-clip regenerate

### Real Neural Audio
- ✅ MusicGen-small browser path (`neural-engine/inference/musicgen.ts`)
- ✅ ~656 MB first download (cached); produces real WAV audio
- ✅ Sidebar “Try real neural audio” button

### Audio & DSP
- ✅ AudioWorklet engine, look-ahead scheduler, true RMS metering
- ✅ Independent per-track Web Audio DSP chains (EQ, compressor, delay, reverb)
- ✅ Live DSP Explorer UI
- ✅ Synthesized WAV mixdown and per-track stems

### Export & Infrastructure
- ✅ MIDI track download
- ✅ DAW project JSON export with optional stem references
- ✅ Distributed rate limiting (Vercel KV / Upstash Redis / memory)
- ✅ Optional `NAW_API_KEY` header gate
- ✅ ONNX loading hooks for DAC, CLAP, ControlNet (no weights shipped)

### Still Planned
- ⬜ Full pretrained DAC + Flow Matching weights
- ⬜ Real CLAP embeddings from uploaded audio
- ⬜ Trained ControlNet adapters
- ⬜ Neural stem export (vs. oscillator stems)
- ⬜ Ableton / Logic / Pro Tools project formats

### AudioWorklet Engine
- ✅ Look-ahead scheduler with input validation
- ✅ Rollback-safe initialization (partial failures clean up resources)
- ✅ Real master RMS metering
- ✅ Per-track true RMS metering via AnalyserNodes

### MIDI
- ✅ Note-On / Note-Off pairing by device/channel/note
- ✅ Held duration recording (minimum one sixteenth)
- ✅ Standard MIDI File export with GM note conversion (pitch labels + drums)
- ✅ Note-off priority so same-tick offs sort before note-ons
- ✅ Unit tests for scheduler, recording buffer, and MIDI serialization

### Project Management
- ✅ Debounced local autosave to `localStorage`
- ✅ Recovery on startup
- ✅ Versioned project envelopes + legacy JSON loading

### Export UI
- ✅ Working MIDI track download
- ✅ Synthesized WAV mixdown export (OfflineAudioContext of prototype oscillators)
- ✅ Synthesized WAV stems export (one WAV per non-muted track of prototype oscillators)
- ✅ Audio stems of neural renders, Ableton, Logic, Pro Tools still marked planned

### Documentation
- ✅ `neural-engine/CAPABILITY_STATUS.md` distinguishes stubs from implemented behavior
- ✅ `NAW_1.4_REVIEW.md` records the stabilization review

## 🎯 Earlier Features (v1.1–v1.5)

### Core Architecture
- Hybrid two-stage design (Semantic Planner + Acoustic Renderer placeholder)
- 4-stem track system: DRUMS, BASS, VOCALS, OTHER
- Independent volume, solo, mute

### User Interface
- Timeline with bar grid, transport, playhead
- Mixer with channel strips
- Piano Roll and Spectrogram views
- Prompt Lane for section-level style changes
- Style Adapters (Jazz, Techno, Orchestral, Lo-fi, Ambient, Hip-hop)

### Audio Engine (Web Audio)
- Synthesized drums, bass, vocal-like, and pad tones for playback feedback
- Look-ahead scheduling
- Master dynamics
- Activity-based per-track meters (v1.5) superseded by true RMS (v1.6)

---

## 🚧 Known Limitations (v1.6)

1. **Neural audio models** – DAC, CLAP inference, trained ControlNet, vocoder, Flow Matching, and generative inpainting remain architecture + stubs. An ONNX Runtime Web scaffold is now present (`neural-engine/inference/onnxScaffold.ts`); DACCodec can optionally load real encoder/decoder ONNX files when URLs are provided. No pretrained weights are shipped.
2. **Audio export** – Synthesized WAV mixdown of prototype oscillators is available. Independent neural stems and DAW project formats (Ableton, Logic, Pro Tools) are still planned.
3. **Per-track metering** – True RMS via per-track AnalyserNodes is implemented. Full multi-output DSP graph with independent effects chains remains future work.
4. **API protection** – Basic in-memory rate limiting (10/min) and optional `NAW_API_KEY` are in place. Distributed/persistent limiting (Redis/KV) is still recommended before public deploy.
5. **Autosave** – browser `localStorage` only; no cloud sync or external audio asset persistence.
6. **MIDI quantization** – note duration uses playhead position; hardware timestamp quantization is future work.

---

## 📅 Planned (Phase 2+)

See [ROADMAP.md](ROADMAP.md) and [neural-engine/CAPABILITY_STATUS.md](neural-engine/CAPABILITY_STATUS.md).

- Real DAC codec + Flow Matching acoustic renderer (pretrained weights)
- CLAP audio conditioning (actual embeddings)
- ControlNet adapters
- Discrete diffusion inpainting
- Independent per-track DSP effects chains
- Neural WAV stem and DAW project export
- Distributed auth / rate limiting (Redis / Vercel KV)

---

**Last Updated**: November 25, 2026  
**Maintainer**: @GizzZmo
