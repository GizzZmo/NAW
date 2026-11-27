<div align="center">

# Neural Audio Workstation (NAW)

**A Production-Grade AI Music Creation Environment**  
Bridging generative AI and professional music production workflows

[![Version](https://img.shields.io/badge/version-1.8.1-green.svg)]()
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()

</div>

## Screenshots

### Main Interface
![NAW UI Overview](assets/screenshots/naw-ui-overview.jpg)

### Piano Roll
![Piano Roll](assets/screenshots/piano-roll.jpg)

### Mixer
![Mixer](assets/screenshots/mixer.jpg)

### Logo
![NAW Logo](assets/logo/naw-logo.jpg)

---

## Local development

The API routes live in `api/` and are Vercel serverless functions.  
`vite` alone does not serve them, so generation returns **404** unless you also run the local API:

```bash
npm install
npm run dev:local    # starts API on :3001 and Vite on :3000 (proxied)
# or separately:
npm run dev:api      # terminal 1
npm run dev          # terminal 2
```

Set provider API keys in the sidebar **AI Agent** panel (or via server env vars).

NAW is a browser-based Digital Audio Workstation that combines **stem-level AI music generation** with professional production tools.

**Current (v1.8) behavior:** NAW generates **editable symbolic note patterns** (MIDI-style events) via a choice of AI agents (Gemini, OpenAI, Grok, Anthropic, OpenRouter). It also includes a real browser-side MusicGen-small path for actual audio, independent per-track Web Audio DSP chains, and a live DSP Explorer. Full pretrained DAC / CLAP / Flow Matching weights are not shipped; ONNX hooks are ready for callers who supply model URLs.

The architecture is designed so those models can be plugged in later without rewriting the UI or scheduling layer.

---

## Key Features (v1.8)

### Symbolic Generation (Multi-Agent)
- Sidebar **AI Agent** panel: choose provider (Gemini, OpenAI, xAI Grok, Anthropic, OpenRouter)
- User-supplied API keys stored in localStorage and sent with each request
- Provider-specific key validation (prefix and length checks)
- Server falls back to matching env var if no user key is present
- Style Adapters, Style Strength, Temperature, per-clip regenerate

### Real Neural Audio
- **MusicGen-small** path (`neural-engine/inference/musicgen.ts`) via `@huggingface/transformers`
- First run downloads ~656 MB; subsequent runs use the browser cache
- Sidebar “Try real neural audio” button produces a downloadable WAV
- License: CC-BY-NC-4.0

### Audio & DSP
- AudioWorklet engine with look-ahead scheduler and true RMS metering
- Independent per-track DSP chains (`services/audio/TrackEffectsChain.ts`): EQ, compressor, delay, reverb send
- Live **DSP Explorer** UI for experimenting with the chain on a test tone
- Synthesized WAV mixdown and per-track stems (OfflineAudioContext)

### Export & Project
- MIDI track download
- DAW project JSON export (`services/audio/DawProjectExport.ts`) with optional stem references

### Infrastructure
- Distributed rate limiting (`api/rateLimit.ts`): Vercel KV → Upstash Redis → in-memory fallback
- Optional `NAW_API_KEY` header gate
- ONNX scaffolds for DAC, CLAP, and ControlNet (supply a model URL to activate)

### AudioWorklet Engine
- Dedicated DSP thread with look-ahead scheduler
- Rollback-safe initialization
- Real master RMS metering
- Per-track true RMS metering via AnalyserNodes
- Initializes on first user gesture

### MIDI
- Web MIDI device enumeration
- Note-On / Note-Off pairing by device/channel/note with held duration recording
- Clip-aware placement
- Standard MIDI File export (GM note conversion, note-off priority)

### Project & Export
- Debounced local autosave + recovery on startup
- Versioned project envelopes (legacy JSON still loads)
- Export modal: working MIDI download + synthesized WAV mixdown (OfflineAudioContext of prototype oscillators)
- Ableton / Logic / Pro Tools project formats still planned

### Arrangement & Editing
- Multi-track timeline, piano roll, spectrogram views
- Mixer with volume, solo, mute and live per-track RMS meters
- Prompt Lane for section-level style changes

---

## Quick Start

```bash
git clone https://github.com/GizzZmo/NAW.git
cd NAW
pnpm install   # or npm install

# For local API route (recommended)
npm run dev:vercel

# Or Vite only (API route not executed)
npm run dev
```

Create a `.env` (or Vercel environment) with `GEMINI_API_KEY` for the server. The key is never sent to the browser.  
Optionally set `NAW_API_KEY` to require an `X-API-Key` header on generation requests.

Open the local URL. Click **Play** or **Generate** once to initialize AudioWorklet and MIDI.

### Generate music
1. Type a prompt (e.g. “Uplifting house track with deep bass, 128 BPM”)
2. Optionally select a Style Adapter and adjust Strength / Temperature
3. Click **Generate**
4. Symbolic clips appear on the timeline; switch to Piano Roll to inspect notes

### Use MIDI
1. Connect a MIDI keyboard or pad
2. Click **Play** (initializes MIDI)
3. Select a track
4. Play notes – they are recorded with real held duration and heard via the AudioWorklet synthesizer

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        UI (React)                       │
│  Semantic Planner │ Timeline │ Piano Roll │ Mixer       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│              /api/generate-blueprint (server)           │
│         Gemini key stays server-side                    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   AudioWorkletEngine                    │
│  Look-ahead Scheduler │ Master RMS │ Note Synthesis     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                     MidiService                         │
│  Device enumeration │ Note pairing │ MIDI File I/O      │
└─────────────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](ARCHITECTURE.md), [FEATURES.md](FEATURES.md), [neural-engine/CAPABILITY_STATUS.md](neural-engine/CAPABILITY_STATUS.md), and [NAW_1.4_REVIEW.md](NAW_1.4_REVIEW.md).

---

## Project Status (v1.6)

| Component | Status |
|-----------|--------|
| Symbolic Planner (Gemini, server-side) | ✅ Working |
| Style Adapters & Controls | ✅ Working |
| AudioWorklet Engine (synthesis + master meter) | ✅ Working |
| MIDI Input / Recording / Export | ✅ Working |
| Autosave + versioned projects | ✅ Working |
| Piano Roll / Timeline / Mixer | ✅ Working |
| Per-track RMS metering | ✅ AnalyserNode-based |
| Synthesized WAV mixdown export | ✅ OfflineAudioContext |
| API rate limiting + optional key | ✅ In-memory + NAW_API_KEY |
| Real neural audio models | 🚧 Architecture + stubs (no pretrained weights) |
| DAW project export (Ableton, Logic, Pro Tools) | 🚧 Planned |
| Auth / distributed rate limiting | 🚧 Basic in-memory; production needs Redis/KV |

---

## License

MIT – see [LICENSE](LICENSE)

---

## Acknowledgments

Built as a research prototype for stem-level AI music generation with professional DAW ergonomics.
