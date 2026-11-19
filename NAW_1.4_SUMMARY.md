# NAW 1.4 Summary

**Date:** November 19, 2026  
**Branch:** `naw/1.4-stabilization` (merged to main)

## What changed

NAW 1.4 is a quality-focused stabilization release. It makes the current product honest and safer while keeping the architecture ready for real neural audio models later.

### Security
- Gemini API key is no longer injected into the client bundle.
- All generation goes through the server-side `/api/generate-blueprint` endpoint.
- Requests and model output are validated.

### Audio & MIDI
- AudioWorklet initialization is rollback-safe.
- Master RMS meter uses real DSP values; random per-track meters were removed.
- MIDI Note On/Off are paired by device/channel/note with held duration recording.
- Standard MIDI File export converts pitch and drum labels to General MIDI and orders note-offs before same-tick note-ons.

### Project & UI
- Debounced local autosave and recovery on startup.
- Versioned project envelopes (legacy JSON still loads).
- Export modal offers working MIDI download and clearly marks audio/DAW formats as unavailable.
- Documentation and capability status accurately describe symbolic generation only.

### Tests
- Unit tests added for the look-ahead scheduler, MIDI recording buffer, and MIDI file I/O.
- `typecheck` script added.

## Still required before production

1. Authentication, rate limiting, and abuse protection on the Gemini endpoint.
2. Full dependency-aware typecheck, Vite production build, and browser/MIDI device testing.
3. Real neural audio models (DAC, CLAP, Flow Matching, vocoder) before claiming high-fidelity audio generation.
4. Per-track DSP routing for individual meters and real audio export.

See `NAW_1.4_REVIEW.md` and `neural-engine/CAPABILITY_STATUS.md` for details.
