# NAW Features Documentation

> **Current Implementation Status (v1.4) and Future Feature Roadmap**

## 🚀 v1.4 Features (Current)

### Security & Generation
- ✅ Gemini calls moved to server-side `/api/generate-blueprint` (key never in client bundle)
- ✅ Request validation (prompt length, BPM range) and model output sanitization
- ✅ Honest status: generates symbolic note patterns only, not high-fidelity audio

### AudioWorklet Engine
- ✅ Look-ahead scheduler with input validation
- ✅ Rollback-safe initialization (partial failures clean up resources)
- ✅ Real master RMS metering
- ✅ Per-track true RMS metering via AnalyserNodes (v1.6)

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

## 🎯 Earlier Features (v1.1–v1.3)

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

---

## 🚧 Known Limitations (v1.4)

1. **Neural audio models** – DAC, CLAP inference, trained ControlNet, vocoder, Flow Matching, and generative inpainting are not production implementations.
2. **Audio export** – WAV stems and DAW project export remain unavailable because the app does not produce independent rendered audio buffers.
3. **Per-track metering** – activity-based meters from note triggers are now shown in the Mixer. Full independent per-track DSP output routing and true RMS metering remains future work.
4. **API protection** – basic in-memory rate limiting (10/min) and optional `NAW_API_KEY` header check added. Distributed/persistent limiting still recommended for public deploy.
5. **Autosave** – browser `localStorage` only; no cloud sync or external audio asset persistence.
6. **MIDI quantization** – note duration uses playhead position; hardware timestamp quantization is future work.

---

## 📅 Planned (Phase 2+)

See [ROADMAP.md](ROADMAP.md) and [neural-engine/CAPABILITY_STATUS.md](neural-engine/CAPABILITY_STATUS.md).

- Real DAC codec + Flow Matching acoustic renderer
- CLAP audio conditioning (actual embeddings)
- ControlNet adapters
- Discrete diffusion inpainting
- Per-track DSP routing and metering
- WAV stem and DAW export once audio buffers exist
- Auth / rate limiting on the generation endpoint

---

**Last Updated**: November 19, 2026  
**Maintainer**: @GizzZmo
