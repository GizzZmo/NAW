
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    ProjectState, Track, Clip, StemType, SpectrogramTool, NoteEvent, EditViewMode 
} from './types';
import { INITIAL_TRACKS, TOTAL_BARS, PIXELS_PER_BAR, STEM_COLORS, TRACK_HEIGHT } from './constants';
import { PRESETS } from './data/presets';
import { generateSongBlueprint } from './services/geminiService';
import { audioEngine } from './services/audioEngine';
import { MixerChannel } from './components/MixerChannel';
import { SpectrogramEditor } from './components/SpectrogramEditor';
import { PianoRoll } from './components/PianoRoll';
import { PromptLane } from './components/PromptLane';
import { ExportModal } from './components/ExportModal';
import { AboutModal } from './components/AboutModal';
import { 
  Play, Pause, Square, Mic, Wand2, Layers, Sliders, Info, MoreHorizontal, 
  Piano, Activity, Brush, Eye, Cpu, Save, Upload, Folder, Download, FileJson, Check,
  Music2, Paintbrush, Scissors, RefreshCw, ChevronDown, UploadCloud
} from 'lucide-react';

// ─── Style Adapter definitions (Phase 3.1) ───────────────────────────────────
const STYLE_ADAPTERS = ['None', 'Jazz', 'Techno', 'Orchestral', 'Lo-fi', 'Ambient', 'Hip-hop'] as const;
type StyleAdapter = (typeof STYLE_ADAPTERS)[number];

const App: React.FC = () => {
  // State
  const [project, setProject] = useState<ProjectState>({
    bpm: 124,
    isPlaying: false,
    currentBar: 0,
    totalBars: TOTAL_BARS,
    tracks: INITIAL_TRACKS,
    prompts: [],
    generationStage: 'IDLE',
    generationProgress: 0,
  });

  const [mainPrompt, setMainPrompt] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>('t1');
  const [spectrogramTool, setSpectrogramTool] = useState<SpectrogramTool>({ mode: 'SELECT', brushSize: 20, showLatents: false });
  const [viewMode, setViewMode] = useState<'ARRANGEMENT' | 'MIXER'>('ARRANGEMENT');
  const [editMode, setEditMode] = useState<EditViewMode>('SPECTROGRAM');
  const [showPresets, setShowPresets] = useState(false);

  // Phase 3.1: Control Adapter state
  const [styleAdapter, setStyleAdapter] = useState<StyleAdapter>('None');
  const [styleStrength, setStyleStrength] = useState(70);
  const [temperature, setTemperature] = useState(50);
  const [showAdapterMenu, setShowAdapterMenu] = useState(false);

  // Phase 3.1: CLAP Audio Reference state
  const [audioRefFile, setAudioRefFile] = useState<File | null>(null);
  const [audioRefDragging, setAudioRefDragging] = useState(false);

  // Phase 3.2: Inpaint context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    clipId: string;
    trackId: string;
  }>({ visible: false, x: 0, y: 0, clipId: '', trackId: '' });

  // Phase 3.3: Export modal
  const [showExportModal, setShowExportModal] = useState(false);

  // About modal
  const [showAboutModal, setShowAboutModal] = useState(false);

  // BPM editing
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [bpmInput, setBpmInput] = useState('');
  const bpmInputRef = useRef<HTMLInputElement>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRefInputRef = useRef<HTMLInputElement>(null);

  // Sync Project State to Audio Engine
  useEffect(() => {
    audioEngine.setTracks(project.tracks);
    audioEngine.setBpm(project.bpm);
  }, [project.tracks, project.bpm]);

  // Handle Playback State
  useEffect(() => {
    if (project.isPlaying) {
      audioEngine.start(project.currentBar);
    } else {
      audioEngine.stop();
    }
  }, [project.isPlaying]);

  // Animation Loop for Playhead
  useEffect(() => {
    if (!project.isPlaying) return;

    let animationId: number;
    const loop = () => {
      const currentEngineBar = audioEngine.getCurrentBar();
      
      setProject(prev => {
        if (currentEngineBar >= prev.totalBars) {
            return { ...prev, isPlaying: false, currentBar: 0 };
        }
        return { ...prev, currentBar: currentEngineBar };
      });
      
      animationId = requestAnimationFrame(loop);
    };
    loop();

    return () => cancelAnimationFrame(animationId);
  }, [project.isPlaying]);

  // --- SAVE / LOAD LOGIC ---

  const handleSaveProject = () => {
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `naw-project-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        // Basic validation
        if (json.tracks && typeof json.bpm === 'number') {
            // Stop playback before loading
            audioEngine.stop();
            setProject({ 
                ...json, 
                isPlaying: false,
                // Ensure we don't break strict types if loading old files
                generationStage: json.generationStage || 'IDLE',
                prompts: json.prompts || []
            });
        } else {
            alert("Invalid project file structure.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse project file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const loadPreset = (presetState: ProjectState) => {
      audioEngine.stop();
      setProject({ ...presetState });
      setShowPresets(false);
  };

  // --- GENERATION LOGIC ---

  const handleGenerate = async () => {
    if (!mainPrompt.trim()) return;

    // Stage 1: Semantic Planner (AR Transformer)
    setProject(prev => ({ ...prev, generationStage: 'PLANNING', generationProgress: 10 }));

    const blueprint = await generateSongBlueprint(mainPrompt, project.bpm);
    
    // Stage 2: Acoustic Renderer (Flow Matching)
    setProject(prev => ({ ...prev, generationStage: 'RENDERING', generationProgress: 40 }));

    let progress = 40;
    const progressInterval = setInterval(() => {
        progress += 5;
        if (progress > 95) clearInterval(progressInterval);
        setProject(prev => ({ ...prev, generationProgress: progress }));
    }, 100);

    setTimeout(() => {
      clearInterval(progressInterval);
      
      const generatedBpm = blueprint.suggestedBpm || project.bpm;
      const stems = blueprint.stems || [];

      // Map Blueprint Stems to Tracks
      const newTracks = project.tracks.map((track, idx) => {
        const stemData = stems.find((s: any) => s.type === track.type) || stems[idx];
        
        const newClips: Clip[] = [];
        
        if (stemData && stemData.pattern && stemData.pattern.length > 0) {
            const patternEvents: NoteEvent[] = stemData.pattern;
            const maxStep = Math.max(...patternEvents.map(e => e.step));
            const LOOP_LENGTH = maxStep >= 32 ? 4 : 2; 
            const REPEATS = Math.ceil(TOTAL_BARS / LOOP_LENGTH);

            for (let r = 0; r < REPEATS; r++) {
               newClips.push({
                   id: Math.random().toString(36),
                   name: `${stemData.description || 'Pattern'}`,
                   startBar: r * LOOP_LENGTH,
                   lengthBars: LOOP_LENGTH,
                   type: track.type,
                   color: STEM_COLORS[track.type],
                   events: patternEvents,
                   latentData: []
               });
            }
        }
        return { ...track, clips: newClips };
      });

      setProject(prev => ({
        ...prev,
        generationStage: 'COMPLETED',
        generationProgress: 100,
        tracks: newTracks,
        bpm: generatedBpm
      }));

      setTimeout(() => {
        setProject(prev => ({ ...prev, generationStage: 'IDLE', generationProgress: 0 }));
      }, 2000);

    }, 2000); 
  };

  const handleTrackUpdate = (id: string, updates: Partial<Track>) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  const addPromptKeyframe = (bar: number) => {
      const text = prompt("Enter style prompt for this section:");
      if(text) {
          setProject(prev => ({
              ...prev,
              prompts: [...prev.prompts, { id: Date.now().toString(), bar, text, timestamp: Date.now() }].sort((a,b) => a.bar - b.bar)
          }));
      }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const bar = x / PIXELS_PER_BAR;
      
      if (project.isPlaying) {
          audioEngine.stop();
          audioEngine.start(bar);
      }
      setProject(prev => ({ ...prev, currentBar: bar }));
  };

  // ── BPM editing ────────────────────────────────────────────────
  const startBpmEdit = () => {
    setBpmInput(String(project.bpm));
    setIsEditingBpm(true);
    setTimeout(() => bpmInputRef.current?.select(), 0);
  };

  const commitBpmEdit = () => {
    const val = parseInt(bpmInput, 10);
    if (!isNaN(val) && val >= 40 && val <= 300) {
      setProject(prev => ({ ...prev, bpm: val }));
    }
    setIsEditingBpm(false);
  };

  // ── CLAP Audio Reference ────────────────────────────────────────
  const handleAudioRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setAudioRefDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioRefFile(file);
    }
  };

  // ── Inpaint Context Menu ────────────────────────────────────────
  const handleClipContextMenu = (
    e: React.MouseEvent,
    trackId: string,
    clipId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, clipId, trackId });
  };

  const handleInpaintClip = () => {
    // Stub: In production this would send the clip + mask to the inpainting engine
    setContextMenu(prev => ({ ...prev, visible: false }));
    const clip = project.tracks
      .find(t => t.id === contextMenu.trackId)
      ?.clips.find(c => c.id === contextMenu.clipId);
    if (clip) {
      alert(`Inpainting "${clip.name}"…\n\n(Stub: In production this triggers discrete diffusion on the selected region.)`);
    }
  };

  const handleRegenerateClip = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    const clip = project.tracks
      .find(t => t.id === contextMenu.trackId)
      ?.clips.find(c => c.id === contextMenu.clipId);
    if (clip) {
      alert(`Regenerating "${clip.name}"…\n\n(Stub: In production this re-runs the acoustic renderer on this clip.)`);
    }
  };

  const closeContextMenu = useCallback(() => {
    if (contextMenu.visible) setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.visible]);

  return (
    <div
      className="flex flex-col h-screen w-screen bg-naw-bg text-slate-200 font-sans selection:bg-naw-accent selection:text-naw-bg"
      onClick={closeContextMenu}
    >
      
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleLoadProject} 
        accept=".json" 
        className="hidden" 
      />
      <input
        type="file"
        ref={audioRefInputRef}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && f.type.startsWith('audio/')) setAudioRefFile(f);
          e.target.value = '';
        }}
        accept="audio/*"
        className="hidden"
      />

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          trackCount={project.tracks.length}
          bpm={project.bpm}
        />
      )}

      {showAboutModal && (
        <AboutModal onClose={() => setShowAboutModal(false)} />
      )}

      {/* Context Menu (right-click on clips) */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-naw-panel border border-slate-600 rounded-lg shadow-2xl py-1 w-52"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleInpaintClip}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 text-slate-200"
          >
            <Paintbrush size={13} className="text-naw-danger" /> Inpaint Region
          </button>
          <button
            onClick={handleRegenerateClip}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 text-slate-200"
          >
            <RefreshCw size={13} className="text-naw-accent" /> Regenerate Clip
          </button>
          <div className="my-1 border-t border-slate-700" />
          <button
            onClick={() => {
              setProject(prev => ({
                ...prev,
                tracks: prev.tracks.map(t =>
                  t.id === contextMenu.trackId
                    ? { ...t, clips: t.clips.filter(c => c.id !== contextMenu.clipId) }
                    : t
                )
              }));
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 text-naw-danger"
          >
            <Scissors size={13} /> Delete Clip
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-naw-panel z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-naw-accent font-mono font-bold text-xl tracking-tighter">
            <Layers className="w-6 h-6" />
            <span>NAW</span>
            <span className="text-xs text-slate-500 font-normal px-2 py-0.5 border border-slate-700 rounded">v1.2</span>
          </div>
          
          {/* Transport Controls */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1 gap-1 ml-6">
            <button 
                onClick={() => setProject(p => ({ ...p, isPlaying: !p.isPlaying }))}
                className={`p-2 rounded hover:bg-slate-700 transition ${project.isPlaying ? 'text-naw-success' : 'text-white'}`}
                title="Play/Pause [Space]"
            >
              {project.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button 
                onClick={() => setProject(p => ({ ...p, isPlaying: false, currentBar: 0 }))}
                className="p-2 rounded hover:bg-slate-700 text-white"
                title="Stop"
            >
              <Square size={18} fill="currentColor" />
            </button>
            <div className="w-px h-6 bg-slate-700 mx-1"></div>
            <button className="p-2 rounded hover:bg-slate-700 text-naw-danger animate-pulse-slow">
              <Mic size={18} />
            </button>
          </div>

          <div className="flex flex-col font-mono text-xs ml-4">
             <span className="text-slate-400">BPM</span>
             {isEditingBpm ? (
               <input
                 ref={bpmInputRef}
                 value={bpmInput}
                 onChange={(e) => setBpmInput(e.target.value)}
                 onBlur={commitBpmEdit}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') commitBpmEdit();
                   if (e.key === 'Escape') setIsEditingBpm(false);
                 }}
                 className="w-16 bg-slate-800 border border-naw-accent rounded px-1 text-naw-accent font-bold text-lg leading-none focus:outline-none"
                 type="number"
                 min={40}
                 max={300}
               />
             ) : (
               <span
                 onClick={startBpmEdit}
                 className="text-naw-accent font-bold text-lg leading-none cursor-pointer hover:text-sky-300 transition"
                 title="Click to edit BPM"
               >
                 {project.bpm}
               </span>
             )}
          </div>
          <div className="flex flex-col font-mono text-xs ml-4">
             <span className="text-slate-400">BAR</span>
             <span className="text-white font-bold text-lg leading-none">
                 {Math.floor(project.currentBar) + 1}.{Math.floor((project.currentBar % 1) * 4) + 1}
             </span>
          </div>
        </div>
        
        {/* Project Management & View Switcher */}
        <div className="flex items-center gap-4">
           {/* File Tools */}
           <div className="flex items-center gap-1 bg-slate-800 rounded p-1">
              <button 
                onClick={handleSaveProject} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                title="Save Project (JSON)"
              >
                  <Download size={16} />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                title="Load Project (JSON)"
              >
                  <Upload size={16} />
              </button>

              {/* Export Button (Phase 3.3) */}
              <button
                onClick={() => setShowExportModal(true)}
                className="p-2 text-slate-400 hover:text-naw-success hover:bg-slate-700 rounded flex items-center gap-1"
                title="Export Stems / Mixdown"
              >
                <Music2 size={16} />
                <span className="text-xs font-bold">Export</span>
              </button>
              
              <div className="relative">
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowPresets(!showPresets); }}
                    className={`p-2 hover:bg-slate-700 rounded flex items-center gap-2 ${showPresets ? 'text-naw-accent bg-slate-700' : 'text-slate-400 hover:text-white'}`}
                    title="Presets"
                >
                    <Folder size={16} />
                    <span className="text-xs font-bold">Presets</span>
                </button>
                
                {/* Presets Dropdown */}
                {showPresets && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded shadow-2xl z-50">
                        <div className="p-2 border-b border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Start New Project
                        </div>
                        {PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => loadPreset(preset.state)}
                                className="w-full text-left p-3 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 group"
                            >
                                <div className="text-sm font-bold text-slate-200 group-hover:text-naw-accent">{preset.name}</div>
                                <div className="text-[10px] text-slate-500">{preset.description}</div>
                            </button>
                        ))}
                    </div>
                )}
              </div>
           </div>

          {project.generationStage !== 'IDLE' && (
            <div className="flex items-center gap-3 bg-slate-800 px-3 py-1.5 rounded-full border border-naw-accent/30 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
               <div className="w-2 h-2 rounded-full bg-naw-accent animate-ping" />
               <span className="text-xs font-mono text-naw-accent">
                 {project.generationStage === 'PLANNING' ? 'SEMANTIC AR' : 'FLOW RENDER'}
                 : {Math.floor(project.generationProgress)}%
               </span>
            </div>
          )}
          
          <div className="flex bg-slate-800 rounded p-1">
             <button 
               onClick={() => setViewMode('ARRANGEMENT')}
               className={`px-3 py-1 text-xs rounded transition ${viewMode === 'ARRANGEMENT' ? 'bg-naw-surface text-white' : 'text-slate-400 hover:text-white'}`}
             >
               Timeline
             </button>
             <button 
               onClick={() => setViewMode('MIXER')}
               className={`px-3 py-1 text-xs rounded transition ${viewMode === 'MIXER' ? 'bg-naw-surface text-white' : 'text-slate-400 hover:text-white'}`}
             >
               Mixer
             </button>
          </div>
          
          <button
            onClick={() => setShowAboutModal(true)}
            className="p-2 hover:bg-slate-800 rounded-full"
            title="About NAW"
          >
            <Info size={20} className="text-slate-400 hover:text-white transition" />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden" onClick={() => setShowPresets(false)}>
        
        {/* LEFT SIDEBAR: GENERATIVE CONTROLS */}
        <div className="w-80 bg-naw-panel border-r border-slate-700 flex flex-col p-4 gap-6 overflow-y-auto shrink-0 z-20 shadow-xl" onClick={(e) => e.stopPropagation()}>
           
           {/* Prompt Input */}
           <div className="flex flex-col gap-2">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Wand2 size={12} /> Semantic Planner
             </label>
             <textarea 
               value={mainPrompt}
               onChange={(e) => setMainPrompt(e.target.value)}
               placeholder="Enter structural prompt..."
               className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:outline-none focus:border-naw-accent resize-none placeholder:text-slate-600 font-mono"
             />
             <button 
               onClick={handleGenerate}
               disabled={project.generationStage !== 'IDLE'}
               className="bg-naw-accent hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-2 rounded flex items-center justify-center gap-2 transition shadow-lg shadow-sky-900/20"
             >
               {project.generationStage === 'IDLE' ? 'Generate Skeleton' : 'Dreaming...'}
             </button>
           </div>

           {/* Editor View Toggle */}
           <div className="flex flex-col gap-2">
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={12} /> Visualization Mode
               </label>
               <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setEditMode('SPECTROGRAM')}
                        className={`flex items-center justify-center gap-2 p-2 rounded text-xs border ${editMode === 'SPECTROGRAM' ? 'bg-naw-surface border-slate-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                        <Activity size={14} /> Spectrogram
                    </button>
                    <button 
                        onClick={() => setEditMode('PIANO_ROLL')}
                        className={`flex items-center justify-center gap-2 p-2 rounded text-xs border ${editMode === 'PIANO_ROLL' ? 'bg-naw-surface border-slate-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                        <Piano size={14} /> Piano Roll
                    </button>
               </div>
           </div>

           {/* Tool Settings (Context Aware) */}
           {editMode === 'SPECTROGRAM' && (
               <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Brush size={12} /> Inpainting Tools
                    </label>
                    <div className="bg-slate-900 rounded p-3 border border-slate-700 flex flex-col gap-3">
                        <div className="flex gap-2">
                             <button 
                                onClick={() => setSpectrogramTool(p => ({ ...p, mode: 'SELECT' }))}
                                className={`flex-1 py-1 text-xs rounded ${spectrogramTool.mode === 'SELECT' ? 'bg-naw-accent text-slate-900 font-bold' : 'bg-slate-800 text-slate-400'}`}
                             >
                                 Select
                             </button>
                             <button 
                                onClick={() => setSpectrogramTool(p => ({ ...p, mode: 'BRUSH' }))}
                                className={`flex-1 py-1 text-xs rounded ${spectrogramTool.mode === 'BRUSH' ? 'bg-naw-danger text-white font-bold' : 'bg-slate-800 text-slate-400'}`}
                             >
                                 Mask
                             </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800">
                             <button 
                                onClick={() => setSpectrogramTool(p => ({ ...p, showLatents: !p.showLatents }))}
                                className={`w-full py-1 text-xs rounded flex items-center justify-center gap-2 ${spectrogramTool.showLatents ? 'bg-naw-secondary text-white' : 'bg-slate-800 text-slate-400'}`}
                             >
                                <Cpu size={12} />
                                {spectrogramTool.showLatents ? 'View Latents' : 'View Audio'}
                             </button>
                        </div>
                    </div>
               </div>
           )}

           {/* ControlNet Settings — Phase 3.1 */}
           <div className="flex flex-col gap-2">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sliders size={12} /> Control Adapters
             </label>
             <div className="bg-slate-900 rounded p-3 border border-slate-700 flex flex-col gap-3">

               {/* Style Adapter Dropdown */}
               <div className="flex flex-col gap-1">
                 <span className="text-xs text-slate-400">Style Adapter</span>
                 <div className="relative">
                   <button
                     onClick={(e) => { e.stopPropagation(); setShowAdapterMenu(v => !v); }}
                     className="w-full flex items-center justify-between bg-slate-800 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-400 transition"
                   >
                     <span className="font-semibold">{styleAdapter}</span>
                     <ChevronDown size={12} className={`transition ${showAdapterMenu ? 'rotate-180' : ''}`} />
                   </button>
                   {showAdapterMenu && (
                     <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl z-30">
                       {STYLE_ADAPTERS.map(a => (
                         <button
                           key={a}
                           onClick={() => { setStyleAdapter(a); setShowAdapterMenu(false); }}
                           className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-700 transition ${styleAdapter === a ? 'text-naw-accent font-bold' : 'text-slate-300'}`}
                         >
                           {a === 'None' ? 'None (Off)' : a}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
               </div>

               {/* Style Strength */}
               <div className="flex flex-col gap-1">
                 <div className="flex justify-between items-center">
                   <span className="text-xs text-slate-300">Style Strength</span>
                   <span className="text-xs font-mono text-naw-accent">{styleStrength}%</span>
                 </div>
                 <input
                   type="range"
                   min={0} max={100} step={1}
                   value={styleStrength}
                   onChange={(e) => setStyleStrength(Number(e.target.value))}
                   className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-naw-accent [&::-webkit-slider-thumb]:rounded-full"
                 />
               </div>

               {/* Temperature */}
               <div className="flex flex-col gap-1">
                 <div className="flex justify-between items-center">
                   <span className="text-xs text-slate-300">Temperature</span>
                   <span className="text-xs font-mono text-naw-accent">{(temperature / 100).toFixed(2)}</span>
                 </div>
                 <input
                   type="range"
                   min={0} max={100} step={1}
                   value={temperature}
                   onChange={(e) => setTemperature(Number(e.target.value))}
                   className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-naw-secondary [&::-webkit-slider-thumb]:rounded-full"
                 />
               </div>
             </div>
           </div>

           {/* CLAP Audio Reference — Phase 3.1 */}
           <div className="flex flex-col gap-2">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
               <UploadCloud size={12} /> Audio Reference (CLAP)
             </label>
             <div
               onDragOver={(e) => { e.preventDefault(); setAudioRefDragging(true); }}
               onDragLeave={() => setAudioRefDragging(false)}
               onDrop={handleAudioRefDrop}
               onClick={() => audioRefInputRef.current?.click()}
               className={`bg-slate-900 rounded p-3 border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition min-h-[72px] ${
                 audioRefDragging
                   ? 'border-naw-accent bg-naw-accent/10'
                   : audioRefFile
                   ? 'border-naw-success/60 bg-naw-success/5'
                   : 'border-slate-700 hover:border-slate-500'
               }`}
             >
               {audioRefFile ? (
                 <>
                   <Music2 size={16} className="text-naw-success" />
                   <span className="text-xs text-naw-success font-semibold truncate max-w-full px-2">{audioRefFile.name}</span>
                   <button
                     onClick={(e) => { e.stopPropagation(); setAudioRefFile(null); }}
                     className="text-[10px] text-slate-500 hover:text-naw-danger transition"
                   >
                     Remove
                   </button>
                 </>
               ) : (
                 <>
                   <UploadCloud size={16} className="text-slate-500" />
                   <span className="text-[11px] text-slate-500 text-center">Drop audio file here<br/>or click to browse</span>
                 </>
               )}
             </div>
             {audioRefFile && (
               <p className="text-[10px] text-slate-500">CLAP embedding will blend with text prompt at {styleStrength}% strength</p>
             )}
           </div>
        </div>

        {/* CENTER: TIMELINE / MIXER */}
        <div className="flex-1 flex flex-col bg-naw-bg relative overflow-hidden">
            
            {viewMode === 'ARRANGEMENT' ? (
                <>
                {/* Timeline Ruler */}
                <div 
                  className="h-8 bg-slate-800 border-b border-slate-700 flex items-end overflow-hidden sticky top-0 z-20 cursor-pointer shrink-0" 
                  ref={timelineRef}
                  onClick={handleSeek}
                >
                    <div 
                        className="flex h-full relative items-end"
                        style={{ width: `${TOTAL_BARS * PIXELS_PER_BAR}px`, transform: `translateX(0px)` }}
                    >
                        {Array.from({ length: TOTAL_BARS }).map((_, i) => (
                            <div 
                                key={i} 
                                className="border-l border-slate-600 h-1/2 text-[10px] text-slate-500 pl-1 font-mono select-none hover:bg-slate-700/50"
                                style={{ width: `${PIXELS_PER_BAR}px` }}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Prompt Lane (New Blueprint Feature) */}
                <PromptLane prompts={project.prompts} onAddPrompt={addPromptKeyframe} />

                {/* Tracks Area */}
                <div className="flex-1 overflow-auto relative">
                     {/* Global Playhead */}
                    <div 
                        className="absolute top-0 bottom-0 w-px bg-naw-success z-30 pointer-events-none shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                        style={{ left: `${project.currentBar * PIXELS_PER_BAR}px` }}
                    >
                        <div className="w-3 h-3 -ml-1.5 bg-naw-success transform rotate-45 -mt-1.5"></div>
                    </div>

                    <div style={{ width: `${TOTAL_BARS * PIXELS_PER_BAR}px` }}>
                        {project.tracks.map((track) => (
                            <div 
                                key={track.id} 
                                className={`flex border-b border-slate-800 relative group transition-colors ${selectedTrackId === track.id ? 'bg-slate-800/40' : ''}`}
                                style={{ height: `${TRACK_HEIGHT}px` }}
                                onClick={() => setSelectedTrackId(track.id)}
                            >
                                {/* Track Header */}
                                <div className="sticky left-0 w-48 bg-naw-panel border-r border-slate-700 z-10 flex flex-col p-2 shrink-0 shadow-lg group-hover:bg-slate-800/80 transition-colors">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-sm truncate" style={{ color: STEM_COLORS[track.type] }}>{track.name}</span>
                                        <div className="flex gap-1">
                                            <div className={`w-2 h-2 rounded-full ${track.muted ? 'bg-red-500' : 'bg-slate-600'}`} />
                                            <div className={`w-2 h-2 rounded-full ${track.solo ? 'bg-yellow-500' : 'bg-slate-600'}`} />
                                        </div>
                                    </div>
                                    <div className="mt-auto flex items-center gap-2">
                                        {track.type === StemType.DRUMS ? <Activity size={12} className="text-slate-500"/> : <Piano size={12} className="text-slate-500"/>}
                                        <div className="text-[10px] text-slate-500">
                                            {editMode === 'SPECTROGRAM' ? 'Spectrogram' : 'Piano Roll'}
                                        </div>
                                    </div>
                                </div>

                                {/* Track Lane Content */}
                                <div className="flex-1 relative bg-slate-900/50">
                                    {/* Grid Lines */}
                                    <div className="absolute inset-0 flex pointer-events-none">
                                        {Array.from({ length: TOTAL_BARS }).map((_, i) => (
                                            <div key={i} className="border-r border-slate-800/50 h-full" style={{ width: `${PIXELS_PER_BAR}px` }}></div>
                                        ))}
                                    </div>

                                    {/* Clips */}
                                    {track.clips.map(clip => (
                                        <div
                                            key={clip.id}
                                            className="absolute top-1 bottom-1 rounded overflow-hidden border border-white/10 hover:border-white/50 transition-colors cursor-pointer shadow-sm group-hover:shadow-md bg-slate-900"
                                            style={{
                                                left: `${clip.startBar * PIXELS_PER_BAR}px`,
                                                width: `${clip.lengthBars * PIXELS_PER_BAR}px`,
                                            }}
                                            onContextMenu={(e) => handleClipContextMenu(e, track.id, clip.id)}
                                        >
                                            <div className="absolute top-0 left-0 right-0 h-4 px-2 flex items-center bg-black/40 text-[10px] font-bold text-white/80 truncate z-10 backdrop-blur-sm">
                                                {clip.name}
                                            </div>
                                            
                                            {/* CLIP CONTENT (Hybrid View) */}
                                            <div className="absolute top-4 bottom-0 left-0 right-0">
                                                {editMode === 'SPECTROGRAM' ? (
                                                    <SpectrogramEditor 
                                                        tool={spectrogramTool}
                                                        width={clip.lengthBars * PIXELS_PER_BAR}
                                                        height={TRACK_HEIGHT - 20}
                                                        isPlaying={project.isPlaying}
                                                        currentBar={project.currentBar - clip.startBar}
                                                        totalBars={clip.lengthBars}
                                                        color={clip.color}
                                                    />
                                                ) : (
                                                    <PianoRoll 
                                                        clip={clip}
                                                        width={clip.lengthBars * PIXELS_PER_BAR}
                                                        height={TRACK_HEIGHT - 20}
                                                        isPlaying={project.isPlaying}
                                                        currentBar={project.currentBar - clip.startBar}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                </>
            ) : (
                /* MIXER VIEW */
                <div className="flex-1 bg-naw-bg p-8 flex justify-center items-center overflow-x-auto">
                    <div className="flex gap-2 h-96 bg-naw-panel p-4 rounded-lg shadow-2xl border border-slate-700">
                        {project.tracks.map(track => (
                            <MixerChannel 
                                key={track.id} 
                                track={track} 
                                onUpdate={handleTrackUpdate} 
                                isPlaying={project.isPlaying}
                            />
                        ))}
                        <div className="w-px h-full bg-slate-600 mx-2"></div>
                        <div className="flex flex-col items-center w-24 bg-naw-surface border border-slate-600 rounded py-4 h-full relative">
                            <span className="text-xs font-bold text-naw-accent mb-2">MASTER</span>
                             <div className="w-4 h-48 bg-slate-900 rounded-full overflow-hidden relative mb-4 border border-slate-500">
                                <div 
                                    className="absolute bottom-0 left-0 w-full bg-naw-accent transition-all duration-75"
                                    style={{ height: project.isPlaying ? '65%' : '0%' }}
                                />
                             </div>
                             <input 
                                type="range" min="0" max="1" step="0.01" defaultValue="0.9"
                                className="absolute h-32 -rotate-90 w-32 origin-center translate-y-10 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-runnable-track]:bg-slate-800"
                                style={{ width: '128px', height: '20px', top: '40px' }}
                             />
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
      
      {/* STATUS BAR */}
      <footer className="h-6 bg-slate-950 border-t border-slate-800 flex items-center px-2 text-[10px] text-slate-500 justify-between shrink-0 z-20">
         <div className="flex gap-4">
             <span className="text-naw-success flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-naw-success animate-pulse"/> Engine Ready</span>
             <span>Sample Rate: 44.1kHz</span>
             <span>Latency: 12ms (ASIO)</span>
             {styleAdapter !== 'None' && (
               <span className="text-naw-secondary">Adapter: {styleAdapter} @ {styleStrength}%</span>
             )}
             {audioRefFile && (
               <span className="text-naw-warning">CLAP Ref: {audioRefFile.name}</span>
             )}
         </div>
         <div className="flex gap-4">
             <span>Memory: 1.2GB / 16GB</span>
             <span>GPU: Neural Engine Active</span>
             <span className="text-slate-600">v1.2 — Phase 3 UI</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
