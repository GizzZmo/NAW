
import React from 'react';
import { PromptKeyframe } from '../types';
import { PIXELS_PER_BAR, TOTAL_BARS } from '../constants';
import { Type } from 'lucide-react';

interface PromptLaneProps {
  prompts: PromptKeyframe[];
  onAddPrompt: (bar: number) => void;
}

export const PromptLane: React.FC<PromptLaneProps> = ({ prompts, onAddPrompt }) => {
  return (
    <div 
        className="h-8 bg-slate-900/50 border-b border-slate-700 relative flex items-center group cursor-text"
        onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const bar = Math.floor(x / PIXELS_PER_BAR);
            onAddPrompt(bar);
        }}
    >
        <div className="absolute left-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2 pointer-events-none">
            <Type size={10} /> Prompt Flow
        </div>
        
        <div style={{ width: `${TOTAL_BARS * PIXELS_PER_BAR}px` }} className="relative h-full">
            {prompts.map(p => (
                <div 
                    key={p.id}
                    className="absolute top-1 bottom-1 flex items-center pl-2 pr-4 bg-naw-secondary/20 border-l-2 border-naw-secondary text-xs text-naw-secondary whitespace-nowrap overflow-hidden hover:overflow-visible hover:bg-slate-800 hover:z-50 hover:border rounded-r transition-all"
                    style={{ left: `${p.bar * PIXELS_PER_BAR}px`, maxWidth: '200px' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="font-mono font-bold mr-2">{p.bar + 1}.1</span>
                    "{p.text}"
                </div>
            ))}
            
            {/* Ghost cursor hint */}
            <div className="opacity-0 group-hover:opacity-50 absolute h-full border-l border-white/20 pointer-events-none top-0" />
        </div>
    </div>
  );
};
