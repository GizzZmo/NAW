# Neural Engine Capability Status (NAW 1.8)

This document distinguishes implemented application behavior from planned model architecture. Class names and architecture diagrams do not imply that pretrained model weights or production inference are present.

| Component | NAW 1.6 status | Notes |
|---|---|---|
| Gemini semantic planner | Integrated symbolic generation | Calls the server-side Gemini endpoint and returns structured note patterns. It does not generate audio waveforms. |
| DAC codec | Architecture + stub (+ ONNX scaffold) | No pretrained DAC checkpoint is shipped. Optional `encoderOnnxUrl` / `decoderOnnxUrl` on `DACConfig` will attempt to load a real model via `onnxruntime-web` (optional dependency). Falls back to stub if unavailable. |
| Acoustic renderer | Architecture + stub | No trained Flow Matching / diffusion model is loaded. |
| Vocoder | Architecture + stub | No verified pretrained vocoder inference pipeline is connected. |
| CLAP conditioning | Architecture + stub | Reference filename is descriptive text context only; uploaded audio is not embedded. |
| ControlNet adapters | Prompt-level controls | Style selections modify prompt context; trained adapters are not loaded. |
| Spectrogram inpainting | UI + stub | The UI/workflow is not connected to a trained generative inpainting model. |
| Per-track DSP | Real Web Audio chains (v1.8) | `services/audio/TrackEffectsChain.ts` provides independent EQ, compressor, delay, reverb-send, and gain per track. |
| DAW project export | JSON project + stem refs (v1.8) | `services/audio/DawProjectExport.ts` serializes tracks, clips, notes, and optional stem filenames. |
| Distributed rate limiting | Redis / Vercel KV + memory fallback (v1.8) | `api/rateLimit.ts` prefers Vercel KV, then Upstash Redis REST, then in-memory. |
| Discrete diffusion inpainting | Algorithmic helper (v1.8) | `neural-engine/inpainting/discreteDiffusion.ts` implements a mask-and-denoise loop over codebook tokens. Model-driven prediction is optional. |
| CLAP / ControlNet / DAC / Flow Matching | Architecture + ONNX hooks | Optional `*OnnxUrl` fields on configs. No pretrained weights are shipped; callers supply model URLs. |
| Audio export | Synthesized WAV mixdown + stems (v1.6.1) | OfflineAudioContext render of prototype oscillators to WAV (mixdown and per-track stems). Neural stem export still pending. |
| ONNX inference path | Scaffold ready | `neural-engine/inference/onnxScaffold.ts` + optional `onnxruntime-web`. Callers supply a `.onnx` URL. No model weights are shipped. |
| MusicGen (real) | Optional, client-side | `neural-engine/inference/musicgen.ts` loads `Xenova/musicgen-small` via `@huggingface/transformers`. First run downloads ~656 MB. Produces real audio. License CC-BY-NC-4.0. |
| API protection | Rate limiting + optional key (v1.6) | In-memory 10 req/min per client + optional `NAW_API_KEY` header check. Ephemeral on serverless. |

## Product behavior

NAW 1.6 should describe the current generation result as an **editable symbolic arrangement**. It must not report a completed high-fidelity audio render when only note patterns have been generated. The UI labels and About panel follow this distinction. Synthesized WAV mixdown exports are of prototype oscillators, not neural models.

## Criteria before claiming production AI audio generation

1. Pin a real model artifact and record its license, checksum, and model version.
2. Implement model loading and inference with explicit device/provider selection.
3. Add deterministic smoke tests using known prompts and expected tensor/audio shapes.
4. Validate generated audio for duration, sample rate, channel count, finite samples, and clipping.
5. Benchmark latency and memory on declared reference hardware.
6. Expose model/provider status and failures to the user; never silently substitute synthetic output.
