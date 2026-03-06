/**
 * @fileoverview About Modal Component
 *
 * Displays project information, feature overview, architecture summary,
 * tech stack, and credits for the Neural Audio Workstation (NAW).
 *
 * @module components/AboutModal
 */

import React from 'react';
import {
  X, Layers, Cpu, Music2, Wand2, Mic, Activity, Info, Github, Heart
} from 'lucide-react';

/** Application version displayed in the About modal */
const APP_VERSION = 'v1.2';

/** GitHub repository URL */
const GITHUB_URL = 'https://github.com/GizzZmo/NAW';

interface AboutModalProps {
  /** Called when the user closes the modal */
  onClose: () => void;
}

const FEATURES = [
  {
    icon: <Layers size={16} className="text-naw-accent" />,
    title: 'Stem-Level Generation',
    description: 'Isolated tracks (Drums, Bass, Vocals, Other) that are phase-aligned and mix-ready.',
  },
  {
    icon: <Wand2 size={16} className="text-naw-secondary" />,
    title: 'Semantic Planner',
    description: 'Autoregressive Transformer produces a coarse musical skeleton from your text prompt in ~2 s.',
  },
  {
    icon: <Activity size={16} className="text-naw-success" />,
    title: 'Acoustic Renderer',
    description: 'Flow-Matching / Diffusion upsampler converts the skeleton into high-fidelity audio.',
  },
  {
    icon: <Mic size={16} className="text-naw-warning" />,
    title: 'CLAP Audio Reference',
    description: 'Drag-and-drop any audio file to condition generation on its timbre and style.',
  },
  {
    icon: <Music2 size={16} className="text-naw-accent" />,
    title: 'Surgical Inpainting',
    description: 'Select and regenerate specific regions with bidirectional diffusion inpainting.',
  },
  {
    icon: <Cpu size={16} className="text-naw-secondary" />,
    title: 'ControlNet Adapters',
    description: 'Genre-specific fine-tuning adapters (Jazz, Techno, Orchestral, Lo-fi, and more).',
  },
];

const TECH_STACK = [
  { label: 'UI', value: 'React 19 + TypeScript' },
  { label: 'Build', value: 'Vite 6' },
  { label: 'Styling', value: 'Tailwind CSS v4' },
  { label: 'AI', value: 'Google Gemini 2.5 Flash' },
  { label: 'Audio', value: 'Web Audio API / ASIO' },
  { label: 'Icons', value: 'Lucide React' },
];

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-naw-panel border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Layers size={22} className="text-naw-accent" />
            <div>
              <h2 className="text-white font-bold text-lg leading-none">
                Neural Audio Workstation
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">NAW — {APP_VERSION} · Phase 3 UI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6">

          {/* Tagline */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 leading-relaxed">
            <Info size={14} className="inline mr-2 text-naw-accent" />
            A <span className="text-naw-accent font-semibold">production-grade AI music creation environment</span> that
            integrates state-of-the-art generation with professional DAW workflows —
            delivering <em>stem-aware generation</em>, <em>surgical editability</em>, and
            <em> multi-modal conditioning</em> for professional creators.
          </div>

          {/* Key Features */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Key Features
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="flex items-start gap-3 bg-slate-800 rounded-lg p-3"
                >
                  <span className="mt-0.5 shrink-0">{f.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{f.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{f.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Architecture Summary */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Two-Stage Architecture
            </h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                <span className="text-naw-accent font-mono text-xs font-bold shrink-0">01</span>
                <div>
                  <div className="text-sm font-semibold text-slate-200">Semantic Planner</div>
                  <div className="text-xs text-slate-400">AR Transformer · Text → Musical Skeleton · ~2 s</div>
                </div>
              </div>
              <div className="flex items-center justify-center text-slate-600 text-xs">↓</div>
              <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                <span className="text-naw-secondary font-mono text-xs font-bold shrink-0">02</span>
                <div>
                  <div className="text-sm font-semibold text-slate-200">Acoustic Renderer</div>
                  <div className="text-xs text-slate-400">Flow Matching / Diffusion · Skeleton → Hi-Fi Audio · ~10 s</div>
                </div>
              </div>
            </div>
          </section>

          {/* Tech Stack */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Tech Stack
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {TECH_STACK.map((t) => (
                <div key={t.label} className="bg-slate-800 rounded-lg px-3 py-2 flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">{t.label}</span>
                  <span className="text-sm text-slate-200 font-mono mt-0.5">{t.value}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <Heart size={11} className="text-naw-danger" />
            MIT License · GizzZmo
          </span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <Github size={14} />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
};
