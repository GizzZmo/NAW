/**
 * Independent per-track DSP effects chains.
 *
 * Each track gets its own chain of Web Audio nodes:
 *   source → EQ (low/mid/high) → compressor → delay → reverb send → gain → analyser → destination
 *
 * Parameters are live-updatable. Chains are created lazily when a track is first played.
 */

export interface TrackEffectsParams {
  /** Low-shelf gain in dB (-12 to +12). */
  lowGain: number;
  /** Peaking mid gain in dB. */
  midGain: number;
  /** High-shelf gain in dB. */
  highGain: number;
  /** Compressor threshold in dB. */
  threshold: number;
  /** Compressor ratio. */
  ratio: number;
  /** Delay time in seconds. */
  delayTime: number;
  /** Delay feedback 0-1. */
  delayFeedback: number;
  /** Reverb send level 0-1. */
  reverbSend: number;
  /** Output gain in dB. */
  gainDb: number;
}

export const DEFAULT_EFFECTS: TrackEffectsParams = {
  lowGain: 0,
  midGain: 0,
  highGain: 0,
  threshold: -24,
  ratio: 4,
  delayTime: 0.25,
  delayFeedback: 0.3,
  reverbSend: 0.15,
  gainDb: 0,
};

export interface TrackChain {
  input: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  delay: DelayNode;
  delayGain: GainNode;
  reverbSend: GainNode;
  output: GainNode;
  analyser: AnalyserNode;
}

/**
 * Create a full effects chain for one track.
 * Caller must connect `chain.input` to the track source and
 * `chain.output` (or analyser) to the destination.
 */
export function createTrackChain(
  ctx: AudioContext | OfflineAudioContext,
  params: TrackEffectsParams = DEFAULT_EFFECTS,
): TrackChain {
  const input = ctx.createGain();
  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 120;
  eqLow.gain.value = params.lowGain;

  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.frequency.value = 1000;
  eqMid.Q.value = 0.7;
  eqMid.gain.value = params.midGain;

  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.value = 8000;
  eqHigh.gain.value = params.highGain;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = params.threshold;
  compressor.ratio.value = params.ratio;
  compressor.knee.value = 6;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.15;

  const delay = ctx.createDelay(2);
  delay.delayTime.value = params.delayTime;
  const delayGain = ctx.createGain();
  delayGain.gain.value = params.delayFeedback;

  const reverbSend = ctx.createGain();
  reverbSend.gain.value = params.reverbSend;

  const output = ctx.createGain();
  output.gain.value = dbToGain(params.gainDb);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.7;

  // Dry path: input → EQ → compressor → output → analyser
  input.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(compressor);
  compressor.connect(output);

  // Delay send (parallel)
  compressor.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(delay); // feedback
  delayGain.connect(output);

  // Reverb send (external reverb bus expected to be connected by caller)
  compressor.connect(reverbSend);

  output.connect(analyser);

  return { input, eqLow, eqMid, eqHigh, compressor, delay, delayGain, reverbSend, output, analyser };
}

/** Update live parameters on an existing chain. */
export function updateTrackChain(chain: TrackChain, params: Partial<TrackEffectsParams>): void {
  if (params.lowGain != null) chain.eqLow.gain.value = params.lowGain;
  if (params.midGain != null) chain.eqMid.gain.value = params.midGain;
  if (params.highGain != null) chain.eqHigh.gain.value = params.highGain;
  if (params.threshold != null) chain.compressor.threshold.value = params.threshold;
  if (params.ratio != null) chain.compressor.ratio.value = params.ratio;
  if (params.delayTime != null) chain.delay.delayTime.value = params.delayTime;
  if (params.delayFeedback != null) chain.delayGain.gain.value = params.delayFeedback;
  if (params.reverbSend != null) chain.reverbSend.gain.value = params.reverbSend;
  if (params.gainDb != null) chain.output.gain.value = dbToGain(params.gainDb);
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Simple algorithmic reverb impulse (decaying noise).
 * Used when no external IR is provided.
 */
export function createSimpleReverbIR(ctx: AudioContext | OfflineAudioContext, durationSec = 1.5, decay = 2.5): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}
