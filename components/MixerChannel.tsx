import React from 'react';
import { Track } from '../types';
import { STEM_COLORS } from '../constants';

interface MixerChannelProps {
  track: Track;
  onUpdate: (id: string, updates: Partial<Track>) => void;
  isPlaying: boolean; // Used to animate meter
}

export const MixerChannel: React.FC<MixerChannelProps> = ({ track, onUpdate, isPlaying }) => {
  return (
    <div className="flex flex-col items-center w-24 bg-naw-surface border-r border-slate-700 py-4 h-full relative">
      <div className="text-xs font-mono font-bold text-slate-400 mb-2 truncate px-2 w-full text-center">
        {track.name}
      </div>

      {/* Gain Meter Simulation */}
      <div className="w-4 h-48 bg-slate-900 rounded-full overflow-hidden relative mb-4 border border-slate-600">
        <div 
          className="absolute bottom-0 left-0 w-full transition-all duration-75 ease-out"
          style={{ 
            height: isPlaying && !track.muted ? `${Math.random() * 80 + 20}%` : '0%', 
            backgroundColor: STEM_COLORS[track.type] 
          }}
        />
        {/* Graticule */}
        <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-30">
             {[...Array(10)].map((_, i) => <div key={i} className="w-full h-px bg-white"></div>)}
        </div>
      </div>

      {/* Fader */}
      <div className="h-32 w-8 relative flex justify-center">
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01"
          value={track.volume}
          onChange={(e) => onUpdate(track.id, { volume: parseFloat(e.target.value) })}
          className="absolute h-32 -rotate-90 w-32 origin-center translate-y-10 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:bg-slate-200 [&::-webkit-slider-thumb]:rounded [&::-webkit-slider-runnable-track]:bg-slate-800 [&::-webkit-slider-runnable-track]:rounded-full"
          style={{ width: '128px', height: '20px', top: '40px' }}
        />
      </div>

      <div className="flex flex-col gap-2 mt-auto w-full px-2">
        <button 
          onClick={() => onUpdate(track.id, { muted: !track.muted })}
          className={`w-full py-1 text-xs font-bold rounded ${track.muted ? 'bg-naw-danger text-white' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}
        >
          M
        </button>
        <button 
           onClick={() => onUpdate(track.id, { solo: !track.solo })}
           className={`w-full py-1 text-xs font-bold rounded ${track.solo ? 'bg-naw-warning text-black' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}
        >
          S
        </button>
      </div>
    </div>
  );
};
