/**
 * DSP AudioWorklet Processor
 *
 * Phase 1 Implementation – Core Engine & Scheduling
 *
 * Runs inside an AudioWorkletGlobalScope (separate DSP thread), keeping all
 * heavy signal-processing completely off the main UI thread and preventing
 * audio dropouts caused by garbage-collection pauses or React renders.
 *
 * Responsibilities:
 *   • Per-sample gain / pan application
 *   • Simple biquad EQ (high-pass, low-shelf, high-shelf)
 *   • Clip-level metering (RMS + peak)
 *   • Parameter-change messages from the main thread
 *
 * The processor registers itself as "naw-dsp-processor" so it can be
 * instantiated via `new AudioWorkletNode(ctx, 'naw-dsp-processor')`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor
 * @see ROADMAP.md § Phase 1.1
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Type helpers (AudioWorklet globals are not in standard lib.dom.d.ts)
 * ──────────────────────────────────────────────────────────────────────── */

/** Biquad filter coefficient set (Direct Form I). */
interface BiquadCoeffs {
  b0: number; b1: number; b2: number;
  a1: number; a2: number;
}

/** Per-channel biquad state (two previous input/output samples). */
interface BiquadState {
  x1: number; x2: number;
  y1: number; y2: number;
}

/* ──────────────────────────────────────────────────────────────────────────
 * DSP helper: biquad coefficient calculation
 * ──────────────────────────────────────────────────────────────────────── */

/** Compute a first-order high-pass biquad (Butterworth) at `fc` Hz. */
function highPassCoeffs(fc: number, sampleRate: number): BiquadCoeffs {
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * 0.707); // Q = 0.707 (Butterworth)
  const b0 = (1 + cosW0) / 2;
  const b1 = -(1 + cosW0);
  const b2 = (1 + cosW0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosW0;
  const a2 = 1 - alpha;
  return {
    b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
    a1: a1 / a0, a2: a2 / a0,
  };
}

/** Apply one biquad sample, updating `state` in place. */
function biquadSample(
  x: number,
  coeffs: BiquadCoeffs,
  state: BiquadState,
): number {
  const y =
    coeffs.b0 * x +
    coeffs.b1 * state.x1 +
    coeffs.b2 * state.x2 -
    coeffs.a1 * state.y1 -
    coeffs.a2 * state.y2;
  state.x2 = state.x1; state.x1 = x;
  state.y2 = state.y1; state.y1 = y;
  return y;
}

/** Global AudioWorklet context accessor (typed). */
type AudioWorkletGlobal = { sampleRate?: number; port?: MessagePort };
function getAudioWorkletGlobal(): AudioWorkletGlobal {
  return (typeof globalThis !== 'undefined' ? globalThis : {}) as unknown as AudioWorkletGlobal;
}

/* ──────────────────────────────────────────────────────────────────────────
 * NawDspProcessor class
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * AudioWorklet processor for NAW's DSP chain.
 *
 * Registered name: `"naw-dsp-processor"`
 *
 * AudioParams (automatable in real-time):
 *   - `gain`   – linear gain, default 1.0
 *   - `pan`    – stereo pan −1 (left) … +1 (right), default 0
 *   - `hpFreq` – high-pass cut-off Hz, default 20
 *
 * MessagePort events (from main thread):
 *   - `{ type: 'setMuted', muted: boolean }`
 *   - `{ type: 'resetMeters' }`
 *
 * MessagePort events (to main thread, 30 fps):
 *   - `{ type: 'meters', rmsL, rmsR, peakL, peakR }`
 */
class NawDspProcessor /* extends AudioWorkletProcessor */ {
  /* AudioWorkletProcessor static descriptor */
  static get parameterDescriptors(): unknown[] {
    return [
      { name: 'gain',   defaultValue: 1.0, minValue: 0, maxValue: 2 },
      { name: 'pan',    defaultValue: 0.0, minValue: -1, maxValue: 1 },
      { name: 'hpFreq', defaultValue: 20,  minValue: 20, maxValue: 20000 },
    ];
  }

  private muted = false;

  // High-pass filter state (one per stereo channel)
  private hpCoeffs: BiquadCoeffs;
  private hpStateL: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 };
  private hpStateR: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 };

  // Cached sample rate (read once from AudioWorklet global)
  private readonly _sampleRate: number;

  // Metering accumulators
  private rmsAccL = 0; private rmsAccR = 0;
  private peakL = 0;   private peakR = 0;
  private meterFrames = 0;
  private readonly meterInterval: number; // blocks between meter posts

  constructor() {
    // super() would be called in a real AudioWorkletProcessor subclass;
    // the AudioWorklet runtime injects `currentTime`, `sampleRate`, and
    // `port` before calling the constructor.
    this._sampleRate = getAudioWorkletGlobal().sampleRate ?? 44100;
    this.hpCoeffs = highPassCoeffs(20, this._sampleRate);
    // Post meters ~30 times per second: 128-sample blocks @ 44.1 kHz ≈ 34/s
    this.meterInterval = Math.round(this._sampleRate / 128 / 30);

    // Listen for control messages from main thread
    const port = getAudioWorkletGlobal().port;
    if (port) {
      port.onmessage = (ev: MessageEvent) => this._handleMessage(ev.data);
    }
  }

  private _handleMessage(data: { type: string; [k: string]: unknown }): void {
    if (data.type === 'setMuted') {
      this.muted = Boolean(data.muted);
    } else if (data.type === 'setHpFreq') {
      this.hpCoeffs = highPassCoeffs(Number(data.freq), this._sampleRate);
    } else if (data.type === 'resetMeters') {
      this.rmsAccL = 0; this.rmsAccR = 0;
      this.peakL = 0;   this.peakR = 0;
      this.meterFrames = 0;
    }
  }

  /**
   * Core DSP render callback – called every 128-sample block by the browser.
   *
   * @param inputs  - Array of input channel arrays
   * @param outputs - Array of output channel arrays
   * @param parameters - AudioParam value arrays
   * @returns `true` to keep the processor alive
   */
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const input  = inputs[0];
    const output = outputs[0];
    if (!input || !output || input.length === 0) return true;

    const gainParam  = parameters['gain']   ?? new Float32Array([1.0]);
    const panParam   = parameters['pan']    ?? new Float32Array([0.0]);
    const hpParam    = parameters['hpFreq'] ?? new Float32Array([20]);

    const inL  = input[0];
    const inR  = input.length > 1 ? input[1] : input[0];
    const outL = output[0];
    const outR = output.length > 1 ? output[1] : output[0];

    const blockLen = inL.length;

    // Recompute HP coefficients if cut-off changed from default (20 Hz)
    const hpFreq = hpParam[0];
    if (Math.abs(hpFreq - 20) > 0.5) {
      this.hpCoeffs = highPassCoeffs(hpFreq, this._sampleRate);
    }

    let rmsL = 0; let rmsR = 0;

    for (let i = 0; i < blockLen; i++) {
      const gain = gainParam.length > 1 ? gainParam[i] : gainParam[0];
      const pan  = panParam.length  > 1 ? panParam[i]  : panParam[0];

      // Equal-power panning
      const angle = ((pan + 1) / 2) * (Math.PI / 2);
      const panL  = Math.cos(angle);
      const panR  = Math.sin(angle);

      // High-pass filter
      const fL = biquadSample(inL[i], this.hpCoeffs, this.hpStateL);
      const fR = biquadSample(inR[i], this.hpCoeffs, this.hpStateR);

      // Apply gain + pan + mute
      const sL = this.muted ? 0 : fL * gain * panL;
      const sR = this.muted ? 0 : fR * gain * panR;

      outL[i] = sL;
      outR[i] = sR;

      rmsL += sL * sL;
      rmsR += sR * sR;
      if (Math.abs(sL) > this.peakL) this.peakL = Math.abs(sL);
      if (Math.abs(sR) > this.peakR) this.peakR = Math.abs(sR);
    }

    this.rmsAccL += rmsL / blockLen;
    this.rmsAccR += rmsR / blockLen;
    this.meterFrames++;

    // Post meters to main thread at ~30 fps
    if (this.meterFrames >= this.meterInterval) {
      const n = this.meterFrames;
      const port = getAudioWorkletGlobal().port;
      if (port) {
        port.postMessage({
          type: 'meters',
          rmsL: Math.sqrt(this.rmsAccL / n),
          rmsR: Math.sqrt(this.rmsAccR / n),
          peakL: this.peakL,
          peakR: this.peakR,
        });
      }
      this.rmsAccL = 0; this.rmsAccR = 0;
      this.peakL = 0;   this.peakR = 0;
      this.meterFrames = 0;
    }

    return true;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Registration
 * In a real AudioWorklet context `registerProcessor` is a global function.
 * The guard lets us import this file from Node.js tests without errors.
 * ──────────────────────────────────────────────────────────────────────── */
declare function registerProcessor(name: string, processorCtor: unknown): void;
if (typeof registerProcessor === 'function') {
  registerProcessor('naw-dsp-processor', NawDspProcessor);
}

export { NawDspProcessor, highPassCoeffs, biquadSample };
export type { BiquadCoeffs, BiquadState };
