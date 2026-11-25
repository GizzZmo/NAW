# NAW Features Documentation

> **Current Implementation Status (v1.6) and Future Feature Roadmap**

## 🚀 v1.6 Features (Current)

### Security & Generation
- ✅ Gemini calls moved to server-side `/api/generate-blueprint` (key never in client bundle)
- ✅ Request validation (prompt length, BPM range) and model output sanitization
- ✅ Honest status: generates symbolic note patterns only, not high-fidelity audio
- ✅ In-memory rate limiting (10 requests/minute per client)
- ✅ Optional `NAW_API_KEY` header check (enable by setting the environment variable)

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

1. **Neural audio models** – DAC, CLAP inference, trained ControlNet, vocoder, Flow Matching, and generative inpainting remain architecture + stubs. No pretrained weights are loaded.
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
