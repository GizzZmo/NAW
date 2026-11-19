# Neural Engine Capability Status (NAW 1.4)

This document distinguishes implemented application behavior from planned model architecture. Class names and architecture diagrams do not imply that pretrained model weights or production inference are present.

| Component | NAW 1.4 status | Notes |
|---|---|---|
| Gemini semantic planner | Integrated symbolic generation | Calls the server-side Gemini endpoint and returns structured note patterns. It does not generate audio waveforms. |
| DAC codec | Prototype / placeholder | No pretrained DAC checkpoint or production encoder/decoder is loaded. |
| Acoustic renderer | Not implemented | No trained Flow Matching / diffusion model is loaded. |
| Vocoder | Not production-ready | No verified pretrained vocoder inference pipeline is connected. |
| CLAP conditioning | Not implemented as model inference | Reference filename is currently descriptive text context only; uploaded audio is not embedded. |
| ControlNet adapters | Prompt-level controls only | Style selections modify prompt context; trained adapters are not loaded. |
| Spectrogram inpainting | Prototype | The UI/workflow is not connected to a trained generative inpainting model. |

## Product behavior

NAW 1.4 should describe the current generation result as an **editable symbolic arrangement**. It must not report a completed high-fidelity audio render when only note patterns have been generated. The UI labels and About panel follow this distinction.

## Criteria before claiming production AI audio generation

1. Pin a real model artifact and record its license, checksum, and model version.
2. Implement model loading and inference with explicit device/provider selection.
3. Add deterministic smoke tests using known prompts and expected tensor/audio shapes.
4. Validate generated audio for duration, sample rate, channel count, finite samples, and clipping.
5. Benchmark latency and memory on declared reference hardware.
6. Expose model/provider status and failures to the user; never silently substitute synthetic output.
