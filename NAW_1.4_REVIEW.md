# NAW 1.4 – Implementation Review (pre-merge)

**Target:** quality-first stabilization of the NAW 1.3b source archive  
**Working branch:** `naw/1.4-export-ui`  
**Merge status:** Not merged; all changes are review-only branches.

## Branch sequence

| Branch | Changes |
|---|---|
| `naw/1.4-security` | Move Gemini provider calls to `/api/generate-blueprint`; remove client-side key injection; validate requests and model output; surface provider errors. |
| `naw/1.4-audio-core` | Make AudioWorklet initialization rollback-safe; validate scheduler inputs; remove random per-track meter animation; use real master RMS for the master meter. |
| `naw/1.4-midi` | Pair MIDI Note On/Off by device/channel/note and record held duration instead of fixed two-step notes. |
| `naw/1.4-project` | Add debounced local autosave, recovery on startup, versioned project envelopes, and legacy project loading. |
| `naw/1.4-midi-export` | Convert pitch labels and drum labels to General MIDI note numbers; validate MIDI events; order note-off before same-tick retriggers; add per-track MIDI download. |
| `naw/1.4-quality` | Add audio/MIDI unit tests to the package test command and CI; add a typecheck script. |
| `naw/1.4-ai-status` | Remove the simulated acoustic-render delay and describe current symbolic-generation capabilities accurately. |
| `naw/1.4-export-ui` | Replace simulated export manifest/progress with working MIDI export and explicit status for unavailable audio/project formats. |

## Verification performed

- TypeScript/TSX syntax transpilation: **13 changed source/test files passed**.
- Focused unit tests: **10 passed, 0 failed** (scheduler, MIDI recording buffer, MIDI serialization).
- `git diff --check`: passed.
- Static search confirms Vite no longer injects `GEMINI_API_KEY` into client bundles.

## Verification not completed

Dependency installation (`npm ci`) timed out in this environment. Consequently, the full dependency-aware TypeScript check, Vite production build, browser runtime tests, and live Gemini endpoint test have **not** been run. The successful syntax transpilation is not a substitute for a full TypeScript typecheck or production build.

## Known limitations / remaining work before production

1. **API abuse protection:** The server-side Gemini key is no longer shipped to the browser, but authentication, distributed rate limiting, quotas, and abuse monitoring still need to be implemented before public deployment.
2. **Local API development:** Use `npm run dev:vercel` (Vercel CLI) so the serverless `/api` route is executed. Plain `npm run dev` starts Vite only.
3. **Neural audio models:** DAC, CLAP inference, trained ControlNet adapters, vocoder inference, acoustic Flow Matching, and generative inpainting are not production implementations. NAW 1.4 generates symbolic note patterns through Gemini; it does not generate high-fidelity audio.
4. **Audio export:** WAV stems, stereo mixdown, Ableton, Logic, and Pro Tools export remain unavailable because the current app does not produce independent rendered audio buffers. The UI now says so rather than creating a fake manifest.
5. **Mixer metering:** Master RMS is connected to the DSP meter. Per-track meters remain unavailable until independent track outputs are routed through the audio graph.
6. **Project autosave:** Autosave uses browser localStorage. It does not yet persist external audio assets or provide cloud sync/version history.
7. **MIDI recording:** Note duration is based on the playhead position at Note On/Off. Recording while transport is stopped or with an unchanging playhead yields the minimum one-step duration; hardware timestamp-to-musical-time quantization remains future work.

## Review / merge policy

Review the branch diffs in order, run CI with dependencies installed, test on supported browsers and MIDI devices, and configure `GEMINI_API_KEY` in the server environment. Do not merge until the outstanding checks and deployment safeguards are accepted.
