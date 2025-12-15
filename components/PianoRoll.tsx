
import React, { useMemo } from 'react';
import { Clip, NoteEvent, StemType } from '../types';
import { PIXELS_PER_BAR } from '../constants';

interface PianoRollProps {
  clip: Clip;
  width: number;
  height: number;
  isPlaying: boolean;
  currentBar: number; // relative to clip
}

export const PianoRoll: React.FC<PianoRollProps> = ({ clip, width, height, isPlaying, currentBar }) => {
  // Map notes to Y position. 
  // For Drums: Fixed lanes. For Tonal: Chromatic scale.
  const isDrums = clip.type === StemType.DRUMS;

  const noteMap = useMemo(() => {
    if (isDrums) return ['OHAT', 'CHAT', 'SNARE', 'KICK'];
    // Simple 2 octave range for visualization
    const notes = [];
    const scale = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];
    for(let i=4; i>=2; i--) {
        scale.forEach(n => notes.push(`${n}${i}`));
    }
    return notes;
  }, [isDrums]);

  const rowHeight = height / noteMap.length;
  const stepWidth = PIXELS_PER_BAR / 16;

  const getNoteY = (note: string | number) => {
    const nStr = String(note).toUpperCase();
    const idx = noteMap.indexOf(nStr);
    if (idx === -1) return -1;
    return idx * rowHeight;
  };

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        {noteMap.map((_, i) => (
            <div key={i} className="border-b border-slate-600 w-full absolute" style={{ top: i * rowHeight, height: rowHeight }} />
        ))}
        {Array.from({ length: clip.lengthBars * 4 }).map((_, i) => (
            <div key={`beat-${i}`} className="border-r border-slate-600 h-full absolute" style={{ left: i * (PIXELS_PER_BAR / 4) }} />
        ))}
      </div>

      {/* Notes */}
      {clip.events.map((event, i) => {
        const y = getNoteY(event.note);
        if (y === -1) return null;
        
        return (
            <div
                key={i}
                className={`absolute rounded-sm border border-black/30 shadow-sm text-[8px] flex items-center justify-center overflow-hidden
                    ${event.isGhost ? 'opacity-50 border-dashed' : 'opacity-100'}
                `}
                style={{
                    left: event.step * stepWidth,
                    top: y + 1,
                    width: Math.max(event.duration * stepWidth - 1, 4),
                    height: rowHeight - 2,
                    backgroundColor: clip.color
                }}
                title={`${event.note} (Vel: ${event.velocity})`}
            >
                {/* Visual velocity bar */}
                <div 
                    className="absolute bottom-0 left-0 right-0 bg-black/20" 
                    style={{ height: `${(1 - event.velocity) * 100}%` }} 
                />
            </div>
        );
      })}

      {/* Playhead (Relative) */}
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10"
        style={{ left: currentBar * PIXELS_PER_BAR }}
      />
    </div>
  );
};
