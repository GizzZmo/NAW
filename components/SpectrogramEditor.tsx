
import React, { useRef, useEffect, useState } from 'react';
import { SpectrogramTool } from '../types';

interface SpectrogramEditorProps {
  tool: SpectrogramTool;
  width: number;
  height: number;
  isPlaying: boolean;
  currentBar: number;
  totalBars: number;
  color: string;
}

export const SpectrogramEditor: React.FC<SpectrogramEditorProps> = ({ 
  tool, width, height, isPlaying, currentBar, totalBars, color 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [masks, setMasks] = useState<{x: number, y: number, w: number, h: number}[]>([]);
  const startPos = useRef<{x: number, y: number}>({ x: 0, y: 0 });

  // Generate background noise "spectrogram" or "latent" representation
  const [bgBitmap, setBgBitmap] = useState<ImageBitmap | null>(null);

  useEffect(() => {
    const createVisuals = async () => {
      const offC = new OffscreenCanvas(width, height);
      const ctx = offC.getContext('2d');
      if(!ctx) return;

      // Dark background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Mode: Standard Spectrogram vs Latent Space Visualization
      if (tool.showLatents) {
          // Matrix/Digital Rain style for Latents
          ctx.font = '10px monospace';
          for (let i = 0; i < width; i+=10) {
              for(let j=0; j< height; j+=10) {
                  if (Math.random() > 0.8) {
                      const val = Math.floor(Math.random() * 9);
                      ctx.fillStyle = Math.random() > 0.5 ? '#34d399' : '#059669'; // Emerald matrix
                      ctx.fillText(val.toString(), i, j);
                  }
              }
          }
      } else {
          // Organic Spectral shapes
          for (let i = 0; i < 2000; i++) {
            const x = Math.random() * width;
            // Bias towards lower frequencies (bottom)
            const yBias = Math.pow(Math.random(), 2); 
            const y = (1 - yBias) * height; 
            
            const h = Math.random() * 40 + 2;
            const w = Math.random() * 6 + 1;
            
            const alpha = Math.random() * 0.6;
            ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.fillRect(x, y - (h/2), w, h);
          }
      }
      
      const bitmap = await offC.transferToImageBitmap();
      setBgBitmap(bitmap);
    };
    createVisuals();
  }, [width, height, color, tool.showLatents]);

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw static background
      if (bgBitmap) {
        ctx.drawImage(bgBitmap, 0, 0);
      }

      // Draw Masks (Inpainting regions)
      // If BRUSH mode, we draw red semi-transparent overlay
      ctx.fillStyle = 'rgba(248, 113, 113, 0.3)'; // Red-400 equivalent
      ctx.strokeStyle = '#f87171';
      ctx.setLineDash([4, 4]);
      
      masks.forEach(mask => {
        ctx.fillRect(mask.x, mask.y, mask.w, mask.h);
        ctx.strokeRect(mask.x, mask.y, mask.w, mask.h);
        
        // Label the mask
        ctx.fillStyle = '#fff';
        ctx.font = '10px Inter';
        ctx.fillText('INPAINT', mask.x + 2, mask.y - 4);
        ctx.fillStyle = 'rgba(248, 113, 113, 0.3)'; // Reset fill
      });

      // Draw Playhead
      const progress = currentBar / totalBars;
      const playheadX = progress * width;
      
      if (playheadX >= 0 && playheadX <= width) {
        ctx.beginPath();
        ctx.strokeStyle = '#fff'; 
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
      }
    };

    let animId: number;
    if (isPlaying) {
        const loop = () => {
            render();
            animId = requestAnimationFrame(loop);
        }
        loop();
    } else {
        render();
    }

    return () => {
      if(animId) cancelAnimationFrame(animId);
    };
  }, [bgBitmap, masks, currentBar, totalBars, isPlaying, width, height]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool.mode !== 'BRUSH') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsDrawing(true);
    startPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    // In "BRUSH" mode, we are technically creating a spectral mask for inpainting
    const newMask = {
      x: Math.min(startPos.current.x, endX),
      y: Math.min(startPos.current.y, endY),
      w: Math.abs(endX - startPos.current.x),
      h: Math.abs(endY - startPos.current.y)
    };

    if (newMask.w > 5 && newMask.h > 5) {
        setMasks(prev => [...prev, newMask]);
    }
    setIsDrawing(false);
  };

  return (
    <div className={`relative border-b border-r border-slate-700/50 overflow-hidden group h-full ${tool.mode === 'BRUSH' ? 'cursor-crosshair' : 'cursor-default'}`}>
        <canvas 
            ref={canvasRef}
            width={width}
            height={height}
            onMouseDown={handleMouseDown}
            // onMouseMove omitted for simplicity in this demo
            onMouseUp={handleMouseUp}
            className="block"
        />
        {/* Hover Overlay */}
        <div className="absolute top-1 right-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end">
            <span className="bg-black/60 text-[9px] text-white px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10">
                {tool.showLatents ? 'LATENT SPACE' : 'SPECTROGRAM'}
            </span>
        </div>
    </div>
  );
};
