/**
 * N-API Bridge
 *
 * Phase 2 Implementation – Plugin Architecture & Compatibility
 *
 * Provides a typed interface for calling C++ DSP functions exposed to the
 * JavaScript runtime via the Node-API (N-API) / node-addon-api binding layer.
 *
 * This module acts as the JS side of the N-API contract.  The native addon
 * (compiled as `naw_native.node`) exposes a set of synchronous and async
 * functions which are wrapped here into a clean TypeScript API.
 *
 * Use cases:
 *   • Zero-copy FFT / spectral analysis in C++
 *   • High-quality sample-rate conversion (libsamplerate)
 *   • Phase-vocoder time-stretching (RubberBand C++ lib)
 *   • Low-level ASIO device management
 *
 * When running in a browser (no native addon available) every method falls
 * back to a JS implementation so that the application remains functional.
 *
 * @see services/plugin/VstClapBridge.ts
 * @see ROADMAP.md § Phase 2.3
 */

/* ──────────────────────────────────────────────────────────────────────────
 * N-API native module shape
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Shape of the native `naw_native.node` addon.
 *
 * In a real implementation the addon is compiled from C++ source and loaded
 * via `require('./naw_native.node')`.  The interface below documents every
 * function the addon must export.
 */
export interface NawNativeAddon {
  /** Compute a real-valued FFT of `samples`. Returns magnitude spectrum. */
  fft(samples: Float32Array, fftSize: number): Float32Array;
  /** Perform high-quality sample-rate conversion using libsamplerate. */
  resample(
    samples: Float32Array,
    fromRate: number,
    toRate: number,
    quality: 'best' | 'medium' | 'fast',
  ): Float32Array;
  /** Apply phase-vocoder time-stretch at `ratio` (0.5 = half speed). */
  timeStretch(
    samples: Float32Array,
    ratio: number,
    sampleRate: number,
    preservePitch: boolean,
  ): Float32Array;
  /** Return the version string of the native addon. */
  version(): string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * JS fallback implementations
 * ──────────────────────────────────────────────────────────────────────── */

/** Very small JS DFT (O(N²)) used as browser fallback for tiny FFT sizes. */
function jsFft(samples: Float32Array, fftSize: number): Float32Array {
  const n = Math.min(samples.length, fftSize);
  const halfN = Math.floor(n / 2) + 1;
  const magnitude = new Float32Array(halfN);
  for (let k = 0; k < halfN; k++) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      re += samples[t] * Math.cos(angle);
      im -= samples[t] * Math.sin(angle);
    }
    magnitude[k] = Math.sqrt(re * re + im * im) / n;
  }
  return magnitude;
}

/** Linear interpolation resampler (low quality but pure JS). */
function jsResample(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  const ratio       = toRate / fromRate;
  const outLength   = Math.round(samples.length * ratio);
  const out         = new Float32Array(outLength);
  const srcLen      = samples.length;
  for (let i = 0; i < outLength; i++) {
    const srcIdx = i / ratio;
    const lo     = Math.floor(srcIdx);
    const hi     = Math.min(lo + 1, srcLen - 1);
    const frac   = srcIdx - lo;
    out[i]       = samples[lo] * (1 - frac) + samples[hi] * frac;
  }
  return out;
}

/** Naive JS time-stretch via linear resampling (pitch not preserved). */
function jsTimeStretch(
  samples: Float32Array,
  ratio: number,
  fromRate: number,
): Float32Array {
  // Simple speed change; phase-vocoder pitch preservation not available in JS fallback
  return jsResample(samples, fromRate, Math.round(fromRate * ratio));
}

/* ──────────────────────────────────────────────────────────────────────────
 * NApiBridge
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Bridge between the JavaScript layer and native C++ DSP functions.
 *
 * @example
 * ```typescript
 * const bridge = new NApiBridge();
 * bridge.loadAddon('./naw_native.node');
 *
 * const spectrum = bridge.fft(pcmBuffer, 2048);
 * const resampled = bridge.resample(pcmBuffer, 44100, 48000);
 * ```
 */
export class NApiBridge {
  private _addon: NawNativeAddon | null = null;
  private _addonPath: string | null = null;

  /** Whether the native addon is loaded and available. */
  get isNativeAvailable(): boolean {
    return this._addon !== null;
  }

  /** Path of the loaded addon (null if using JS fallback). */
  get addonPath(): string | null {
    return this._addonPath;
  }

  /**
   * Attempt to load the native addon from the given path.
   *
   * Falls back silently to JS implementations if the addon is not found.
   * Safe to call in browser environments (will always use JS fallback).
   */
  loadAddon(path: string): boolean {
    try {
      // Dynamic require – only works in Node.js / Electron environments
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const addon = require(path) as NawNativeAddon;
      if (typeof addon.fft === 'function') {
        this._addon = addon;
        this._addonPath = path;
        return true;
      }
    } catch {
      // Not available in browser / addon not compiled – use JS fallback
    }
    return false;
  }

  /**
   * Compute FFT magnitude spectrum.
   *
   * Uses native C++ (libfftw3) when available, otherwise a JS DFT fallback.
   *
   * @param samples - Input PCM Float32Array
   * @param fftSize - FFT window size (power of two recommended)
   * @returns Magnitude spectrum of length `fftSize / 2 + 1`
   */
  fft(samples: Float32Array, fftSize = 2048): Float32Array {
    if (this._addon) {
      return this._addon.fft(samples, fftSize);
    }
    return jsFft(samples, fftSize);
  }

  /**
   * High-quality sample-rate conversion.
   *
   * Uses libsamplerate in native mode, linear interpolation as fallback.
   *
   * @param samples  - Input PCM
   * @param fromRate - Source sample rate (Hz)
   * @param toRate   - Target sample rate (Hz)
   * @param quality  - Conversion quality ('best' | 'medium' | 'fast')
   */
  resample(
    samples: Float32Array,
    fromRate: number,
    toRate: number,
    quality: 'best' | 'medium' | 'fast' = 'medium',
  ): Float32Array {
    if (this._addon) {
      return this._addon.resample(samples, fromRate, toRate, quality);
    }
    return jsResample(samples, fromRate, toRate);
  }

  /**
   * Phase-vocoder time-stretch.
   *
   * Uses RubberBand C++ library in native mode, naive speed-change as fallback.
   *
   * @param samples       - Input PCM Float32Array
   * @param ratio         - Time-stretch ratio (1.0 = no change, 2.0 = 2× slower)
   * @param sampleRate    - Sample rate of the input audio
   * @param preservePitch - Whether to preserve pitch (only in native mode)
   */
  timeStretch(
    samples: Float32Array,
    ratio: number,
    sampleRate = 44100,
    preservePitch = true,
  ): Float32Array {
    if (this._addon) {
      return this._addon.timeStretch(samples, ratio, sampleRate, preservePitch);
    }
    return jsTimeStretch(samples, ratio, sampleRate);
  }

  /** Version string of the native addon, or 'js-fallback' if not loaded. */
  version(): string {
    return this._addon?.version() ?? 'js-fallback';
  }
}

/** Singleton N-API bridge for the application. */
export const nApiBridge = new NApiBridge();
