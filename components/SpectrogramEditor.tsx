/**
 * @fileoverview Spectrogram Editor Component
 * 
 * This component renders a visual representation of audio in the frequency domain
 * (spectrogram) or the neural codec's latent space. It supports interactive masking
 * for future inpainting functionality.
 * 
 * ## Visualization Modes
 * 
 * 1. **Spectrogram Mode** (default): Simulates a frequency-over-time display
 *    - Vertical axis: Frequency (low at bottom, high at top)
 *    - Horizontal axis: Time (left to right)
 *    - Color intensity: Amplitude at that frequency/time
 * 
 * 2. **Latent Mode**: Shows the neural codec's internal representation
 *    - Matrix-style digital rain visualization
 *    - Each digit represents a codebook index (0-9 simplified)
 *    - Useful for debugging and understanding the model's compression
 * 
 * ## Interaction
 * 
 * - **BRUSH Tool**: Click and drag to create a mask (red overlay)
 * - **Masks**: Regions marked for inpainting (future: regenerate with AI)
 * - **Playhead**: White vertical line shows current playback position
 * 
 * ## Architecture Context
 * 
 * In the full NAW pipeline, this component will:
 * 1. Display real spectrograms computed via STFT
 * 2. Show actual RVQ codebook indices (not simulated digits)
 * 3. Send mask coordinates to the Diffusion Inpainting service
 * 4. Render inpainted results in real-time
 * 
 * @module components/SpectrogramEditor
 */

import React, { useRef, useEffect, useState } from 'react';
import { SpectrogramTool } from '../types';

/**
 * Props for the SpectrogramEditor component.
 * 
 * @interface SpectrogramEditorProps
 */
interface SpectrogramEditorProps {
  /** Current tool configuration (mode, brush size, latent view toggle) */
  tool: SpectrogramTool;
  
  /** Canvas width in pixels (matches clip width) */
  width: number;
  
  /** Canvas height in pixels (typically TRACK_HEIGHT - header) */
  height: number;
  
  /** Whether playback is active (triggers animation loop) */
  isPlaying: boolean;
  
  /** Current playhead position within this clip (0.0 to totalBars) */
  currentBar: number;
  
  /** Total duration of the clip in bars */
  totalBars: number;
  
  /** Hex color for stem (tints the spectrogram visualization) */
  color: string;
}

/**
 * Spectrogram Editor Component
 * 
 * Renders a canvas-based visualization of audio with interactive masking for inpainting.
 * 
 * **Performance Optimizations:**
 * - Uses OffscreenCanvas for background pre-rendering
 * - Only animates when playing (conditional requestAnimationFrame)
 * - Transfers bitmap to ImageBitmap for fast drawing
 * 
 * **Future Enhancements:**
 * - Real STFT computation (via Web Audio API AnalyserNode)
 * - Zoom/pan controls
 * - Frequency scale labels
 * - Multi-select masks (Shift+Click)
 * - Mask editing (resize, move, delete)
 * 
 * @component
 * @example
 * <SpectrogramEditor 
 *   tool={{ mode: 'BRUSH', brushSize: 20, showLatents: false }}
 *   width={240}
 *   height={80}
 *   isPlaying={true}
 *   currentBar={1.5}
 *   totalBars={4}
 *   color="#f87171"
 * />
 */
export const SpectrogramEditor: React.FC<SpectrogramEditorProps> = ({ 
  tool, width, height, isPlaying, currentBar, totalBars, color 
}) => {
  // ═══════════════════════════════════════════════════════════════
  // REFS & STATE
  // ═══════════════════════════════════════════════════════════════
  
  /** Reference to the canvas DOM element */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  /** Whether user is currently dragging to create a mask */
  const [isDrawing, setIsDrawing] = useState(false);
  
  /** Array of mask regions (for inpainting) */
  const [masks, setMasks] = useState<{x: number, y: number, w: number, h: number}[]>([]);
  
  /** Starting position of mask drag */
  const startPos = useRef<{x: number, y: number}>({ x: 0, y: 0 });

  /** Pre-rendered background (spectrogram or latent visualization) */
  const [bgBitmap, setBgBitmap] = useState<ImageBitmap | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // BACKGROUND GENERATION EFFECT
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Generates the background visualization (spectrogram or latent space).
   * 
   * This runs once when the component mounts or when visualization parameters change.
   * Uses OffscreenCanvas for better performance (doesn't block main thread).
   * 
   * **Spectrogram Mode:**
   * - Renders ~2000 random colored bars
   * - Biases towards lower frequencies (bottom of canvas) for realism
   * - Uses stem color with random alpha for visual variety
   * 
   * **Latent Mode:**
   * - Matrix-style digital rain (green digits on black)
   * - Represents the codec's discrete token space
   * - In production, would show actual RVQ indices (0-1023)
   */
  useEffect(() => {
    const createVisuals = async () => {
      // Use OffscreenCanvas for off-main-thread rendering
      const offC = new OffscreenCanvas(width, height);
      const ctx = offC.getContext('2d');
      if(!ctx) return;

      // Dark background (slate-950)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Mode: Standard Spectrogram vs Latent Space Visualization
      if (tool.showLatents) {
          // ─────────────────────────────────────────────────────────
          // LATENT SPACE MODE: Matrix/Digital Rain
          // ─────────────────────────────────────────────────────────
          ctx.font = '10px monospace';
          for (let i = 0; i < width; i+=10) {
              for(let j=0; j< height; j+=10) {
                  if (Math.random() > 0.8) {
                      // Random digit 0-9 (represents codebook index)
                      const val = Math.floor(Math.random() * 9);
                      // Emerald green tones (matrix aesthetic)
                      ctx.fillStyle = Math.random() > 0.5 ? '#34d399' : '#059669';
                      ctx.fillText(val.toString(), i, j);
                  }
              }
          }
      } else {
          // ─────────────────────────────────────────────────────────
          // SPECTROGRAM MODE: Organic Frequency Bands
          // ─────────────────────────────────────────────────────────
          for (let i = 0; i < 2000; i++) {
            const x = Math.random() * width;
            
            // Bias towards lower frequencies (bottom of canvas)
            // Most musical energy is in low/mid range
            const yBias = Math.pow(Math.random(), 2); 
            const y = (1 - yBias) * height; 
            
            // Variable bar dimensions
            const h = Math.random() * 40 + 2;
            const w = Math.random() * 6 + 1;
            
            // Semi-transparent stem color
            const alpha = Math.random() * 0.6;
            ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.fillRect(x, y - (h/2), w, h);
          }
      }
      
      // Transfer to bitmap for fast blitting during animation
      const bitmap = await offC.transferToImageBitmap();
      setBgBitmap(bitmap);
    };
    createVisuals();
  }, [width, height, color, tool.showLatents]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Main rendering loop.
   * 
   * Draws the spectrogram, masks, and playhead on every frame (if playing)
   * or once (if stopped). Uses requestAnimationFrame for smooth 60fps updates.
   * 
   * **Render Layers (bottom to top):**
   * 1. Static background (bgBitmap)
   * 2. Inpainting masks (red semi-transparent rectangles)
   * 3. Playhead (white vertical line)
   * 
   * **Performance:**
   * - Background is pre-rendered, just blitted once per frame
   * - Only animates when isPlaying is true
   * - Cleanup via cancelAnimationFrame prevents memory leaks
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Layer 1: Draw static background
      if (bgBitmap) {
        ctx.drawImage(bgBitmap, 0, 0);
      }

      // Layer 2: Draw Masks (Inpainting regions)
      // Red overlay indicates masked areas
      ctx.fillStyle = 'rgba(248, 113, 113, 0.3)'; // Red-400 with alpha
      ctx.strokeStyle = '#f87171';
      ctx.setLineDash([4, 4]); // Dashed border for visibility
      
      masks.forEach(mask => {
        ctx.fillRect(mask.x, mask.y, mask.w, mask.h);
        ctx.strokeRect(mask.x, mask.y, mask.w, mask.h);
        
        // Label the mask
        ctx.fillStyle = '#fff';
        ctx.font = '10px Inter';
        ctx.fillText('INPAINT', mask.x + 2, mask.y - 4);
        ctx.fillStyle = 'rgba(248, 113, 113, 0.3)'; // Reset fill
      });

      // Layer 3: Draw Playhead
      const progress = currentBar / totalBars;
      const playheadX = progress * width;
      
      if (playheadX >= 0 && playheadX <= width) {
        ctx.beginPath();
        ctx.strokeStyle = '#fff'; 
        ctx.lineWidth = 1;
        ctx.setLineDash([]); // Solid line
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
      }
    };

    let animId: number;
    
    // Conditional animation: only loop if playing
    if (isPlaying) {
        const loop = () => {
            render();
            animId = requestAnimationFrame(loop);
        }
        loop();
    } else {
        // Render once if stopped
        render();
    }

    // Cleanup: cancel animation on unmount or dependency change
    return () => {
      if(animId) cancelAnimationFrame(animId);
    };
  }, [bgBitmap, masks, currentBar, totalBars, isPlaying, width, height]);

  // ═══════════════════════════════════════════════════════════════
  // MOUSE INTERACTION HANDLERS
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Handles mousedown event to start mask creation.
   * 
   * Only active when tool mode is 'BRUSH'. Records the starting position
   * for drag-to-select functionality.
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool.mode !== 'BRUSH') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsDrawing(true);
    startPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  /**
   * Handles mouseup event to finalize mask creation.
   * 
   * Calculates the bounding box from start to end position and adds it
   * to the masks array if the area is large enough (>5px in each dimension).
   * 
   * **Future Enhancement:**
   * - Send mask coordinates to Diffusion Inpainting API
   * - Store mask in clip metadata for persistence
   * - Allow right-click to delete masks
   */
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    // Calculate bounding box (normalized to top-left origin)
    const newMask = {
      x: Math.min(startPos.current.x, endX),
      y: Math.min(startPos.current.y, endY),
      w: Math.abs(endX - startPos.current.x),
      h: Math.abs(endY - startPos.current.y)
    };

    // Only add if mask is large enough (prevent accidental clicks)
    if (newMask.w > 5 && newMask.h > 5) {
        setMasks(prev => [...prev, newMask]);
    }
    setIsDrawing(false);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER JSX
  // ═══════════════════════════════════════════════════════════════
  
  return (
    <div className={`relative border-b border-r border-slate-700/50 overflow-hidden group h-full ${tool.mode === 'BRUSH' ? 'cursor-crosshair' : 'cursor-default'}`}>
        <canvas 
            ref={canvasRef}
            width={width}
            height={height}
            onMouseDown={handleMouseDown}
            // onMouseMove omitted for simplicity in this demo (future: live preview)
            onMouseUp={handleMouseUp}
            className="block"
        />
        
        {/* Mode Indicator (appears on hover) */}
        <div className="absolute top-1 right-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end">
            <span className="bg-black/60 text-[9px] text-white px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10">
                {tool.showLatents ? 'LATENT SPACE' : 'SPECTROGRAM'}
            </span>
        </div>
    </div>
  );
};
