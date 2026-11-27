/**
 * Real text-to-music via Xenova/musicgen-small (Transformers.js).
 *
 * First production-capable neural path in NAW.
 * Downloads ~656 MB of quantized ONNX weights on first use (cached by the browser).
 * Runs entirely client-side. License: CC-BY-NC-4.0 (non-commercial).
 *
 * Usage:
 *   const result = await generateWithMusicGen("uplifting house track, 128 bpm");
 *   // result.samples is Float32Array mono, result.sampleRate is typically 32000
 */

export interface MusicGenOptions {
  /** Max new tokens (roughly controls duration). Default 256 (~5-8 s). */
  maxNewTokens?: number;
  /** Classifier-free guidance scale. Default 3. */
  guidanceScale?: number;
  /** Whether to sample. Default true. */
  doSample?: boolean;
  /** Progress callback: 0-1 during model load, then generation. */
  onProgress?: (stage: string, progress: number) => void;
}

export interface MusicGenResult {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
}

const MODEL_ID = 'Xenova/musicgen-small';

let tokenizer: any = null;
let model: any = null;
let loading: Promise<void> | null = null;

async function ensureLoaded(onProgress?: MusicGenOptions['onProgress']): Promise<void> {
  if (model && tokenizer) return;
  if (loading) return loading;

  loading = (async () => {
    onProgress?.('Loading MusicGen (first run downloads ~656 MB)...', 0);
    const { AutoTokenizer, MusicgenForConditionalGeneration, env } = await import('@huggingface/transformers');

    // Prefer WASM for stability; WebGPU has known issues with this model.
    env.backends.onnx.wasm.proxy = true;

    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    model = await MusicgenForConditionalGeneration.from_pretrained(MODEL_ID, {
      dtype: {
        text_encoder: 'q8',
        decoder_model_merged: 'q8',
        encodec_decode: 'fp32',
      },
      progress_callback: (info: any) => {
        if (info.status === 'progress' && info.progress != null) {
          onProgress?.(`Loading ${info.file || 'model'}`, info.progress / 100);
        }
      },
    });
    onProgress?.('Model ready', 1);
  })();

  return loading;
}

/**
 * Generate mono audio from a text prompt using MusicGen-small.
 * Returns raw PCM samples and sample rate.
 */
export async function generateWithMusicGen(
  prompt: string,
  options: MusicGenOptions = {},
): Promise<MusicGenResult> {
  const {
    maxNewTokens = 256,
    guidanceScale = 3,
    doSample = true,
    onProgress,
  } = options;

  await ensureLoaded(onProgress);
  onProgress?.('Generating...', 0);

  const inputs = tokenizer(prompt);
  const audioValues = await model.generate({
    ...inputs,
    max_new_tokens: maxNewTokens,
    do_sample: doSample,
    guidance_scale: guidanceScale,
  });

  const samples = audioValues.data as Float32Array;
  const sampleRate = model.config.audio_encoder.sampling_rate as number;
  const durationSec = samples.length / sampleRate;

  onProgress?.('Done', 1);
  return { samples, sampleRate, durationSec };
}

/**
 * Convenience: generate and return a WAV Blob (mono 16-bit).
 */
export async function generateMusicGenWav(
  prompt: string,
  options?: MusicGenOptions,
): Promise<{ blob: Blob; sampleRate: number; durationSec: number }> {
  const { samples, sampleRate, durationSec } = await generateWithMusicGen(prompt, options);
  const blob = encodeWav(samples, sampleRate);
  return { blob, sampleRate, durationSec };
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
