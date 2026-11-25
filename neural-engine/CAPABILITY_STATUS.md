# Neural Engine Capability Status (NAW 1.6)

This document distinguishes implemented application behavior from planned model architecture. Class names and architecture diagrams do not imply that pretrained model weights or production inference are present.

| Component | NAW 1.6 status | Notes |
|---|---|---|
| Gemini semantic planner | Integrated symbolic generation | Calls the server-side Gemini endpoint and returns structured note patterns. It does not generate audio waveforms. |
| DAC codec | Architecture + stub | No pretrained DAC checkpoint or production encoder/decoder is loaded. Interface ready for future ONNX/WASM. |
| Acoustic renderer | Architecture + stub | No trained Flow Matching / diffusion model is loaded. |
| Vocoder | Architecture + stub | No verified pretrained vocoder inference pipeline is connected. |
| CLAP conditioning | Architecture + stub | Reference filename is descriptive text context only; uploaded audio is not embedded. |
| ControlNet adapters | Prompt-level controls | Style selections modify prompt context; trained adapters are not loaded. |
| Spectrogram inpainting | UI + stub | The UI/workflow is not connected to a trained generative inpainting model. |
| Per-track metering | True RMS (v1.6) | Per-track AnalyserNodes provide real RMS from the live synthesis graph. |
| Audio export | Synthesized WAV mixdown (v1.6) | OfflineAudioContext render of prototype oscillators to WAV. Neural stem export still pending. |
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
