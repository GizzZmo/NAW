/**
 * DSP AudioWorklet Processor with improved note synthesis
 * Louder notes (0.35) and longer sustain for better MIDI feedback.
 */

interface BiquadCoeffs {
  b0: number; b1: number; b2: number;
  a1: number; a2: number;
}

interface BiquadState {
  x1: number; x2: number;
  y1: number; y2: number;
}

function highPassCoeffs(fc: number, sampleRate: number): BiquadCoeffs {
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * 0.707);
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

function biquadSample(x: number, coeffs: BiquadCoeffs, state: BiquadState): number {
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

type AudioWorkletGlobal = { sampleRate?: number; port?: MessagePort };
function getAudioWorkletGlobal(): AudioWorkletGlobal {
  return (typeof globalThis !== 'undefined' ? globalThis : {}) as unknown as AudioWorkletGlobal;
}

class NawDspProcessor {
  static get parameterDescriptors(): unknown[] {
    return [
      { name: 'gain',   defaultValue: 1.0, minValue: 0, maxValue: 2 },
      { name: 'pan',    defaultValue: 0.0, minValue: -1, maxValue: 1 },
      { name: 'hpFreq', defaultValue: 20,  minValue: 20, maxValue: 20000 },
    ];
  }

  private muted = false;
  private notes: { freq: number; vel: number; age: number }[] = [];

  private hpCoeffs: BiquadCoeffs;
  private hpStateL: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 };
  private hpStateR: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 };

  private readonly _sampleRate: number;
  private rmsAccL = 0; private rmsAccR = 0;
  private peakL = 0;   private peakR = 0;
  private meterFrames = 0;
  private readonly meterInterval: number;

  constructor() {
    this._sampleRate = getAudioWorkletGlobal().sampleRate ?? 44100;
    this.hpCoeffs = highPassCoeffs(20, this._sampleRate);
    this.meterInterval = Math.round(this._sampleRate / 128 / 30);

    const port = getAudioWorkletGlobal().port;
    if (port) {
      port.onmessage = (ev: MessageEvent) => this._handleMessage(ev.data);
    }
  }

  private _handleMessage(data: { type: string; [k: string]: unknown }): void {
    if (data.type === 'setMuted') {
      this.muted = Boolean(data.muted);
    } else if (data.type === 'noteOn') {
      this.notes.push({ freq: Number(data.freq), vel: Number(data.vel), age: 0 });
    } else if (data.type === 'noteOff') {
      this.notes = this.notes.filter(n => Math.abs(n.freq - Number(data.freq)) > 1);
    } else if (data.type === 'setHpFreq') {
      this.hpCoeffs = highPassCoeffs(Number(data.freq), this._sampleRate);
    } else if (data.type === 'resetMeters') {
      this.rmsAccL = 0; this.rmsAccR = 0;
      this.peakL = 0;   this.peakR = 0;
      this.meterFrames = 0;
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output) return true;

    const inL = input[0] || new Float32Array(128);
    const inR = input[1] || inL;
    const outL = output[0];
    const outR = output[1] || outL;

    const gain = parameters.gain?.[0] ?? 1;
    const pan = parameters.pan?.[0] ?? 0;
    const panL = Math.cos((pan + 1) * Math.PI / 4);
    const panR = Math.sin((pan + 1) * Math.PI / 4);

    let rmsL = 0, rmsR = 0;
    const blockLen = outL.length;

    for (let i = 0; i < blockLen; i++) {
      const fL = biquadSample(inL[i], this.hpCoeffs, this.hpStateL);
      const fR = biquadSample(inR[i], this.hpCoeffs, this.hpStateR);

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

    // Simple polyphonic note synthesis — louder and clearer
    if (this.notes.length && outputs[0]) {
      const oL = outputs[0][0];
      const oR = outputs[0][1] || oL;
      for (let i = 0; i < oL.length; i++) {
        let s = 0;
        for (const n of this.notes) {
          const phase = (n.age / this._sampleRate) * n.freq * Math.PI * 2;
          s += Math.sin(phase) * n.vel * 0.35 * Math.exp(-n.age / this._sampleRate * 1.5);
          n.age++;
        }
        oL[i] += s;
        if (oR !== oL) oR[i] += s;
      }
      this.notes = this.notes.filter(n => n.age < this._sampleRate * 3);
    }

    return true;
  }
}

declare function registerProcessor(name: string, processorCtor: unknown): void;
if (typeof registerProcessor === 'function') {
  registerProcessor('naw-dsp-processor', NawDspProcessor);
}

export { NawDspProcessor, highPassCoeffs, biquadSample };
export type { BiquadCoeffs, BiquadState };
