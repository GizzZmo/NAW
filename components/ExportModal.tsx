/**
 * Export availability for NAW 1.4.
 *
 * The current engine stores symbolic note events, not rendered per-track audio.
 * This dialog therefore exposes the working MIDI export and clearly marks
 * audio/project formats as unavailable instead of simulating downloads.
 */

import React from 'react';
import { X, Download, FileAudio, Music2, Layers, Info } from 'lucide-react';

interface ExportModalProps {
  onClose: () => void;
  onExportMidi: () => void;
  trackCount: number;
  bpm: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  onClose,
  onExportMidi,
  trackCount,
  bpm,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="bg-naw-panel border border-slate-600 rounded-xl shadow-2xl w-[520px] max-w-[calc(100vw-2rem)] overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Download size={18} className="text-naw-accent" />
          <span className="font-bold text-white text-base">Export Project</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition" aria-label="Close export dialog">
          <X size={16} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="text-xs text-slate-400">
          {trackCount} tracks · {bpm} BPM · NAW 1.4
        </div>

        <section className="rounded-lg border border-naw-accent/60 bg-naw-accent/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Music2 size={20} className="text-naw-accent" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Standard MIDI files</div>
              <div className="text-xs text-slate-400">One editable .mid file for each track with note timing and velocity</div>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Available</span>
          </div>
          <button onClick={onExportMidi} className="w-full px-4 py-2 text-sm bg-naw-accent hover:bg-sky-500 text-slate-900 font-bold rounded flex items-center justify-center gap-2 transition">
            <Download size={14} /> Export MIDI tracks
          </button>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-amber-400 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-slate-200">Audio export is not available yet</div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                NAW currently generates symbolic note patterns. It does not yet render independent audio stems or a stereo master, so WAV export would create misleading or empty files.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div className="rounded bg-slate-900/70 p-2 flex items-center gap-2"><FileAudio size={14} /> WAV stems · planned</div>
            <div className="rounded bg-slate-900/70 p-2 flex items-center gap-2"><FileAudio size={14} /> Stereo mixdown · planned</div>
            <div className="rounded bg-slate-900/70 p-2 flex items-center gap-2"><Layers size={14} /> Ableton project · planned</div>
            <div className="rounded bg-slate-900/70 p-2 flex items-center gap-2"><Layers size={14} /> Logic / Pro Tools · planned</div>
          </div>
        </section>
      </div>

      <div className="flex justify-end p-5 border-t border-slate-700">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition">Close</button>
      </div>
    </div>
  </div>
);
