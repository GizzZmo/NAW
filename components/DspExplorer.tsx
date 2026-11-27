import React, { useEffect, useRef, useState } from 'react';
import {
  createTrackChain,
  updateTrackChain,
  createSimpleReverbIR,
  DEFAULT_EFFECTS,
  type TrackEffectsParams,
  type TrackChain,
} from '../services/audio/TrackEffectsChain';

/**
 * Live explorer for the per-track Web Audio DSP chain.
 * Plays a simple test tone through EQ → compressor → delay → reverb.
 */
export const DspExplorer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [params, setParams] = useState<TrackEffectsParams>({ ...DEFAULT_EFFECTS });
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const chainRef = useRef<TrackChain | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const reverbRef = useRef<ConvolverNode | null>(null);

  const ensureGraph = async () => {
    if (ctxRef.current) return;
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const chain = createTrackChain(ctx, params);
    chainRef.current = chain;

    const reverb = ctx.createConvolver();
    reverb.buffer = createSimpleReverbIR(ctx, 1.8, 2.2);
    reverbRef.current = reverb;
    chain.reverbSend.connect(reverb);
    reverb.connect(chain.output);

    chain.output.connect(ctx.destination);
  };

  const start = async () => {
    await ensureGraph();
    const ctx = ctxRef.current!;
    if (ctx.state === 'suspended') await ctx.resume();

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 110;
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    osc.connect(gain);
    gain.connect(chainRef.current!.input);
    osc.start();
    oscRef.current = osc;
    setPlaying(true);
  };

  const stop = () => {
    oscRef.current?.stop();
    oscRef.current = null;
    setPlaying(false);
  };

  useEffect(() => {
    if (chainRef.current) updateTrackChain(chainRef.current, params);
  }, [params]);

  useEffect(() => {
    return () => {
      oscRef.current?.stop();
      ctxRef.current?.close();
    };
  }, []);

  const set = (key: keyof TrackEffectsParams, value: number) =>
    setParams(p => ({ ...p, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-naw-panel border border-slate-600 rounded-lg p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Web Audio DSP Explorer</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Test tone → EQ (low/mid/high) → compressor → delay → reverb → output
        </p>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className="flex flex-col">Low shelf (dB)
            <input type="range" min="-12" max="12" step="0.5" value={params.lowGain} onChange={e => set('lowGain', +e.target.value)} />
            <span className="text-slate-500">{params.lowGain}</span>
          </label>
          <label className="flex flex-col">Mid peak (dB)
            <input type="range" min="-12" max="12" step="0.5" value={params.midGain} onChange={e => set('midGain', +e.target.value)} />
            <span className="text-slate-500">{params.midGain}</span>
          </label>
          <label className="flex flex-col">High shelf (dB)
            <input type="range" min="-12" max="12" step="0.5" value={params.highGain} onChange={e => set('highGain', +e.target.value)} />
            <span className="text-slate-500">{params.highGain}</span>
          </label>
          <label className="flex flex-col">Compressor threshold
            <input type="range" min="-40" max="0" step="1" value={params.threshold} onChange={e => set('threshold', +e.target.value)} />
            <span className="text-slate-500">{params.threshold} dB</span>
          </label>
          <label className="flex flex-col">Delay time
            <input type="range" min="0" max="1" step="0.01" value={params.delayTime} onChange={e => set('delayTime', +e.target.value)} />
            <span className="text-slate-500">{params.delayTime.toFixed(2)} s</span>
          </label>
          <label className="flex flex-col">Delay feedback
            <input type="range" min="0" max="0.9" step="0.01" value={params.delayFeedback} onChange={e => set('delayFeedback', +e.target.value)} />
            <span className="text-slate-500">{params.delayFeedback.toFixed(2)}</span>
          </label>
          <label className="flex flex-col">Reverb send
            <input type="range" min="0" max="1" step="0.01" value={params.reverbSend} onChange={e => set('reverbSend', +e.target.value)} />
            <span className="text-slate-500">{params.reverbSend.toFixed(2)}</span>
          </label>
          <label className="flex flex-col">Output gain
            <input type="range" min="-24" max="12" step="0.5" value={params.gainDb} onChange={e => set('gainDb', +e.target.value)} />
            <span className="text-slate-500">{params.gainDb} dB</span>
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          {!playing ? (
            <button onClick={start} className="px-4 py-2 bg-naw-accent text-slate-900 font-bold rounded text-sm">Play test tone</button>
          ) : (
            <button onClick={stop} className="px-4 py-2 bg-red-600 text-white font-bold rounded text-sm">Stop</button>
          )}
          <button onClick={() => setParams({ ...DEFAULT_EFFECTS })} className="px-3 py-2 bg-slate-700 text-slate-200 rounded text-sm">Reset</button>
        </div>
      </div>
    </div>
  );
};
