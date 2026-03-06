/**
 * @fileoverview Export Modal Component
 *
 * Phase 3.3 Implementation - Multi-Track Export UI
 *
 * Provides a modal dialog for exporting stems in various professional formats:
 * - Individual WAV stems (DRUMS.wav, BASS.wav, etc.)
 * - Stereo mixdown
 * - Ableton Live / Logic Pro project folder structures
 *
 * @module components/ExportModal
 */

import React, { useState } from 'react';
import { X, Download, FileAudio, Layers, Music, Check } from 'lucide-react';

/** Export format options */
type ExportFormat = 'WAV_STEMS' | 'WAV_MIXDOWN' | 'ABLETON_PROJECT' | 'LOGIC_PROJECT' | 'PROTOOLS_SESSION';
type BitDepth = 16 | 24 | 32;

interface ExportModalProps {
  /** Called when the user closes the modal */
  onClose: () => void;
  /** Number of tracks (stems) in the project */
  trackCount: number;
  /** Project BPM for metadata export */
  bpm: number;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'WAV_STEMS',
    label: 'WAV Stems',
    description: 'Individual WAV file per stem (DRUMS.wav, BASS.wav…)',
    icon: <FileAudio size={16} />,
  },
  {
    value: 'WAV_MIXDOWN',
    label: 'Stereo Mixdown',
    description: 'Single stereo WAV file with all stems mixed',
    icon: <Music size={16} />,
  },
  {
    value: 'ABLETON_PROJECT',
    label: 'Ableton Live',
    description: 'Ableton .als project with stems pre-loaded on tracks',
    icon: <Layers size={16} />,
  },
  {
    value: 'LOGIC_PROJECT',
    label: 'Logic Pro',
    description: 'Logic Pro X project folder structure',
    icon: <Layers size={16} />,
  },
  {
    value: 'PROTOOLS_SESSION',
    label: 'Pro Tools',
    description: 'Pro Tools .ptx session file',
    icon: <Layers size={16} />,
  },
];

const SAMPLE_RATE_OPTIONS = [44100, 48000, 88200, 96000];

export const ExportModal: React.FC<ExportModalProps> = ({ onClose, trackCount, bpm }) => {
  const [format, setFormat] = useState<ExportFormat>('WAV_STEMS');
  const [bitDepth, setBitDepth] = useState<BitDepth>(24);
  const [sampleRate, setSampleRate] = useState(44100);
  const [normalize, setNormalize] = useState(false);
  const [dither, setDither] = useState(true);
  const [exportState, setExportState] = useState<'idle' | 'exporting' | 'done'>('idle');
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = () => {
    setExportState('exporting');
    setExportProgress(0);

    // Simulate export progress
    const stemNames = ['DRUMS', 'BASS', 'VOCALS', 'OTHER'];
    let step = 0;
    const totalSteps = format === 'WAV_STEMS' ? trackCount * 10 : 20;

    const tick = setInterval(() => {
      step++;
      const pct = Math.min(100, Math.round((step / totalSteps) * 100));
      setExportProgress(pct);

      if (pct >= 100) {
        clearInterval(tick);
        setExportState('done');

        // In a real implementation, we'd trigger a file download here.
        // For the stub, we just show the "done" state.
        // If WAV_STEMS, create a simulated JSON manifest for demonstration:
        if (format === 'WAV_STEMS') {
          const manifest = {
            format,
            sampleRate,
            bitDepth,
            bpm,
            stems: stemNames.slice(0, trackCount).map((name) => ({
              name,
              file: `${name}.wav`,
              channels: 2,
              duration: '00:01:30',
            })),
            exportedAt: new Date().toISOString(),
          };
          const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `naw-export-manifest-${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    }, 80);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-naw-panel border border-slate-600 rounded-xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Download size={18} className="text-naw-accent" />
            <span className="font-bold text-white text-base">Export Project</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Format Selection */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Export Format
            </label>
            <div className="flex flex-col gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                    format === opt.value
                      ? 'bg-naw-accent/10 border-naw-accent text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <span className={format === opt.value ? 'text-naw-accent' : ''}>{opt.icon}</span>
                  <div>
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-[11px] text-slate-500">{opt.description}</div>
                  </div>
                  {format === opt.value && (
                    <Check size={14} className="ml-auto text-naw-accent shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Settings */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Audio Settings
            </label>
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex flex-col gap-3">
              {/* Sample Rate */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Sample Rate</span>
                <div className="flex gap-1">
                  {SAMPLE_RATE_OPTIONS.map((sr) => (
                    <button
                      key={sr}
                      onClick={() => setSampleRate(sr)}
                      className={`px-2 py-0.5 text-xs rounded ${
                        sampleRate === sr
                          ? 'bg-naw-accent text-slate-900 font-bold'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {sr >= 1000 ? `${sr / 1000}k` : sr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bit Depth */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Bit Depth</span>
                <div className="flex gap-1">
                  {([16, 24, 32] as BitDepth[]).map((bd) => (
                    <button
                      key={bd}
                      onClick={() => setBitDepth(bd)}
                      className={`px-2 py-0.5 text-xs rounded ${
                        bitDepth === bd
                          ? 'bg-naw-accent text-slate-900 font-bold'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {bd}-bit
                    </button>
                  ))}
                </div>
              </div>

              {/* Normalize */}
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-slate-300">Normalize</span>
                  <p className="text-[11px] text-slate-500">Peak normalization to −0.1 dBFS</p>
                </div>
                <button
                  onClick={() => setNormalize(!normalize)}
                  className={`w-10 h-5 rounded-full relative transition ${
                    normalize ? 'bg-naw-accent' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      normalize ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Dither (only visible for 16-bit) */}
              {bitDepth === 16 && (
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-slate-300">Dithering</span>
                    <p className="text-[11px] text-slate-500">Recommended for 16-bit export</p>
                  </div>
                  <button
                    onClick={() => setDither(!dither)}
                    className={`w-10 h-5 rounded-full relative transition ${
                      dither ? 'bg-naw-accent' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        dither ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Export Progress */}
          {exportState !== 'idle' && (
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              {exportState === 'done' ? (
                <div className="flex items-center gap-2 text-naw-success">
                  <Check size={16} />
                  <span className="text-sm font-semibold">Export complete!</span>
                  {format === 'WAV_STEMS' && (
                    <span className="text-xs text-slate-400 ml-1">(manifest downloaded)</span>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>Exporting stems…</span>
                    <span>{exportProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-naw-accent transition-all duration-75 rounded-full"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exportState === 'exporting'}
            className="px-5 py-2 text-sm bg-naw-accent hover:bg-sky-500 text-slate-900 font-bold rounded flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            {exportState === 'exporting' ? 'Exporting…' : exportState === 'done' ? 'Export Again' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};
