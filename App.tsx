
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    ProjectState, Track, Clip, StemType, SpectrogramTool, NoteEvent, EditViewMode 
} from './types';
import { INITIAL_TRACKS, TOTAL_BARS, PIXELS_PER_BAR, STEM_COLORS, TRACK_HEIGHT } from './constants';
import { PRESETS } from './data/presets';
import { generateSongBlueprint } from './services/geminiService';
import { audioEngine } from './services/audioEngine';
import { audioWorkletEngine } from './services/audio/AudioWorkletEngine';
import { midiService } from './services/midi/MidiService';
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

// ─── Style Adapter definitions (Phase 3.1) ─────────────────────────────────
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

  // AudioWorklet + MIDI integration
  const [workletReady, setWorkletReady] = useState(false);
  const [midiReady, setMidiReady] = useState(false);
  const [midiDevices, setMidiDevices] = useState<{id: string; name: string; type: string}[]>([]);
  const [meter, setMeter] = useState({ rmsL: 0, rmsR: 0 });

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
        if (json.tracks && typeof json.bpm === 'number') {
            audioEngine.stop();
            setProject({ 
                ...json, 
                isPlaying: false,
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

    setProject(prev => ({ ...prev, generationStage: 'PLANNING', generationProgress: 10 }));

    const blueprint = await generateSongBlueprint(mainPrompt, project.bpm, {
      styleAdapter,
      styleStrength,
      temperature,
      audioRefName: audioRefFile?.name
    });
    
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

  // ── AudioWorklet + MIDI init (user-gesture safe) ───────────────────
  const initAdvancedAudio = async () => {
    if (!workletReady) {
      try {
        await audioWorkletEngine.initialize();
        audioWorkletEngine.onMeterUpdate = (m) => {
          setMeter({ rmsL: m.rmsL, rmsR: m.rmsR });
        };
        setWorkletReady(true);
      } catch (e) {
        console.warn('AudioWorklet init failed', e);
      }
    }
    if (!midiReady) {
      const ok = await midiService.initialize();
      setMidiReady(ok);
      if (ok) {
        const inputs = midiService.getInputDevices();
        const outputs = midiService.getOutputDevices();
        setMidiDevices([
          ...inputs.map(d => ({ id: d.id, name: d.name, type: 'in' })),
          ...outputs.map(d => ({ id: d.id, name: d.name, type: 'out' })),
        ]);
        midiService.onMessage = (msg) => {
          if (msg.status === 0x90 && msg.data2 > 0) {
            console.log('MIDI note', msg.data1, 'vel', msg.data2);
          }
        };
      }
    }
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

  // ── CLAP Audio Reference ────────────────────────────────────────────
  const handleAudioRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setAudioRefDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioRefFile(file);
    }
  };

  // ── Inpaint Context Menu ────────────────────────────────────────────
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
    setContextMenu(prev => ({ ...prev, visible: false }));
    const clip = project.tracks
      .find(t => t.id === contextMenu.trackId)
      ?.clips.find(c => c.id === contextMenu.clipId);
    if (clip) {
      alert(`Inpainting "${clip.name}"…\n\n(Stub: In production this triggers discrete diffusion on the selected region.)`);
    }
  };

  const handleRegenerateClip = async () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    const track = project.tracks.find(t => t.id === contextMenu.trackId);
    const clip = track?.clips.find(c => c.id === contextMenu.clipId);
    if (!clip || !track) return;

    const stemPrompt = `${mainPrompt || 'Musical pattern'}. Focus only on the ${track.type} stem. Keep it complementary to the other stems.`;
    
    setProject(prev => ({ ...prev, generationStage: 'PLANNING', generationProgress: 20 }));

    try {
      const blueprint = await generateSongBlueprint(stemPrompt, project.bpm, {
        styleAdapter,
        styleStrength,
        temperature,
        audioRefName: audioRefFile?.name
      });

      const stemData = blueprint.stems?.find((s: any) => s.type === track.type) || blueprint.stems?.[0];
      if (stemData?.pattern?.length) {
        setProject(prev => ({
          ...prev,
          generationStage: 'COMPLETED',
          generationProgress: 100,
          tracks: prev.tracks.map(t =>
            t.id === track.id
              ? {
                  ...t,
                  clips: t.clips.map(c =>
                    c.id === clip.id
                      ? { ...c, events: stemData.pattern, name: stemData.description || c.name }
                      : c
                  )
                }
              : t
          )
        }));
      }
    } catch (err) {
      console.error('Regenerate failed', err);
    } finally {
      setTimeout(() => {
        setProject(prev => ({ ...prev, generationStage: 'IDLE', generationProgress: 0 }));
      }, 1500);
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

      <header className="h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-naw-panel z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-naw-accent font-mono font-bold text-xl tracking-tighter">
            <Layers className="w-6 h-6" />
            <span>NAW</span>
            <span className="text-xs text-slate-500 font-normal px-2 py-0.5 border border-slate-700 rounded">v1.3</span>
          </div>
          
          <div className="flex items-center bg-slate-800 rounded-lg p-1 gap-1 ml-6">
            <button 
                onClick={async () => {
                await initAdvancedAudio();
                setProject(p => ({ ...p, isPlaying: !p.isPlaying }));
              }}
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
        
        <div className="flex items-center gap-4">
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
                    onClick={() => setShowPresets(!showPresets)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                    title="Load Preset"
                 >
                     <Folder size={16} />
                 </button>
                 
                 {showPresets && (
                     <div className="absolute top-full right-0 mt-2 w-64 bg-naw-panel border border-slate-600 rounded-lg shadow-2xl z-50 overflow-hidden">
                         <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-800">Presets</div>
                         {PRESETS.map(preset => (
                             <button 
                                key={preset.name}
                                onClick={() => loadPreset(preset.state)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-700 text-sm text-slate-200 border-b border-slate-700 last:border-0 flex items-center justify-between group"
                             >
                                 <span>{preset.name}</span>
                                 <Check size={14} className="opacity-0 group-hover:opacity-100 text-naw-accent" />
                             </button>
                         ))}
                     </div>
                 )}
              </div>
           </div>

           <div className="w-px h-6 bg-slate-700"></div>

           <div className="flex items-center bg-slate-800 rounded-lg p-1">
              <button 
                 onClick={() => setViewMode('ARRANGEMENT')}
                 className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition ${
                    viewMode === 'ARRANGEMENT' ? 'bg-naw-accent text-naw-bg' : 'text-slate-400 hover:text-white'
                 }`}
              >
                 <Activity size={14} /> Timeline
              </button>
              <button 
                 onClick={() => setViewMode('MIXER')}
                 className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition ${
                    viewMode === 'MIXER' ? 'bg-naw-accent text-naw-bg' : 'text-slate-400 hover:text-white'
                 }`}
              >
                 <Sliders size={14} /> Mixer
              </button>
           </div>

           <button 
             onClick={() => setShowAboutModal(true)}
             className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
             title="About NAW"
           >
             <Info size={16} />
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-slate-700 bg-naw-panel flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-3">
              <Wand2 size={16} className="text-naw-accent" />
              Semantic Planner
            </h2>
            <textarea
              value={mainPrompt}
              onChange={(e) => setMainPrompt(e.target.value)}
              placeholder="Describe the music you want to generate...\n\nE.g. 'Uplifting house track with energetic drums and deep bass, 128 BPM'"
              className="w-full h-32 bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-naw-accent resize-none"
            />
            <button
              onClick={async () => {
              await initAdvancedAudio();
              handleGenerate();
            }}
              disabled={!mainPrompt.trim() || project.generationStage !== 'IDLE'}
              className="mt-3 w-full bg-naw-accent hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-naw-bg font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
            >
              {project.generationStage === 'IDLE' ? (
                <><Cpu size={16} /> Generate Skeleton</>
              ) : (
                <><RefreshCw size={16} className="animate-spin" /> {project.generationStage}...</>
              )}
            </button>

            {project.generationStage !== 'IDLE' && (
              <div className="mt-3">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-naw-accent transition-all duration-300"
                    style={{ width: `${project.generationProgress}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1 text-center">{project.generationProgress}%</div>
              </div>
            )}
          </div>

          <div className="p-4 border-b border-slate-700 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Style Adapter</label>
              <div className="relative mt-1">
                <button
                  onClick={() => setShowAdapterMenu(!showAdapterMenu)}
                  className="w-full flex items-center justify-between bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm hover:border-naw-accent transition"
                >
                  <span className="font-semibold">{styleAdapter}</span>
                  <ChevronDown size={14} className={`transition ${showAdapterMenu ? 'rotate-180' : ''}`} />
                </button>
                {showAdapterMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-naw-panel border border-slate-600 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                    {STYLE_ADAPTERS.map(a => (
                      <button
                        key={a}
                        onClick={() => { setStyleAdapter(a); setShowAdapterMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition ${styleAdapter === a ? 'text-naw-accent font-bold' : 'text-slate-300'}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Style Strength</span>
                <span className="text-naw-accent font-mono">{styleStrength}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={styleStrength}
                onChange={(e) => setStyleStrength(Number(e.target.value))}
                className="w-full accent-naw-accent"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Temperature</span>
                <span className="text-naw-accent font-mono">{(temperature / 100).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full accent-naw-accent"
              />
            </div>
          </div>

          <div className="p-4 border-b border-slate-700">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">CLAP Audio Reference</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setAudioRefDragging(true); }}
              onDragLeave={() => setAudioRefDragging(false)}
              onDrop={handleAudioRefDrop}
              onClick={() => audioRefInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition ${
                audioRefDragging
                  ? 'border-naw-accent bg-slate-800'
                  : audioRefFile
                    ? 'border-naw-success bg-slate-800'
                    : 'border-slate-600 hover:border-slate-500'
              }`}
            >
              {audioRefFile ? (
                <div className="flex flex-col items-center gap-1">
                  <UploadCloud size={20} className="text-naw-success" />
                  <span className="text-xs text-naw-success font-semibold truncate max-w-full px-2">{audioRefFile.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAudioRefFile(null); }}
                    className="text-[10px] text-slate-500 hover:text-naw-danger mt-1"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-500">
                  <UploadCloud size={20} />
                  <span className="text-xs">Drop audio or click to browse</span>
                </div>
              )}
            </div>
            {audioRefFile && (
              <p className="text-[10px] text-slate-500 mt-2 text-center">Reference will influence generation style</p>
            )}
          </div>

          <div className="flex-1" />

          <div className="p-3 border-t border-slate-700 text-[10px] text-slate-500 space-y-1">
            {styleAdapter !== 'None' && (
              <div>Adapter: <span className="text-naw-secondary">{styleAdapter} @ {styleStrength}%</span></div>
            )}
            {audioRefFile && (
              <div>CLAP Ref: <span className="text-naw-warning">{audioRefFile.name}</span></div>
            )}
            <div>Temp: <span className="text-slate-400">{(temperature / 100).toFixed(2)}</span></div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-naw-bg">
          {viewMode === 'ARRANGEMENT' ? (
            <>
              <div className="h-12 border-b border-slate-700 bg-slate-900/50 flex items-center px-2 shrink-0">
                <PromptLane prompts={project.prompts} onAddPrompt={addPromptKeyframe} currentBar={project.currentBar} />
              </div>

              <div 
                ref={timelineRef}
                className="flex-1 overflow-auto relative"
                onClick={handleSeek}
              >
                <div className="sticky top-0 z-10 h-6 bg-slate-800 border-b border-slate-700 flex" style={{ width: TOTAL_BARS * PIXELS_PER_BAR }}>
                  {Array.from({ length: TOTAL_BARS }, (_, i) => (
                    <div key={i} className="border-r border-slate-700 text-[10px] text-slate-500 flex items-center justify-center" style={{ width: PIXELS_PER_BAR }}>
                      {i + 1}
                    </div>
                  ))}
                </div>

                <div 
                  className="absolute top-0 bottom-0 w-px bg-naw-accent z-20 pointer-events-none"
                  style={{ left: project.currentBar * PIXELS_PER_BAR }}
                />

                <div className="relative" style={{ width: TOTAL_BARS * PIXELS_PER_BAR }}>
                  {project.tracks.map(track => (
                    <div 
                      key={track.id}
                      className={`border-b border-slate-700 flex ${selectedTrackId === track.id ? 'bg-slate-800/50' : ''}`}
                      style={{ height: TRACK_HEIGHT }}
                      onClick={() => setSelectedTrackId(track.id)}
                    >
                      <div className="w-32 shrink-0 border-r border-slate-700 bg-naw-panel flex items-center px-2 gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STEM_COLORS[track.type] }} />
                        <span className="text-xs font-bold truncate">{track.name}</span>
                      </div>

                      <div className="flex-1 relative">
                        {track.clips.map(clip => (
                          <div
                            key={clip.id}
                            className="absolute top-1 bottom-1 rounded border border-slate-600 bg-slate-800/80 hover:bg-slate-700 cursor-pointer overflow-hidden"
                            style={{
                              left: clip.startBar * PIXELS_PER_BAR,
                              width: clip.lengthBars * PIXELS_PER_BAR - 4,
                              borderLeftColor: STEM_COLORS[track.type]
                            }}
                            onContextMenu={(e) => handleClipContextMenu(e, track.id, clip.id)}
                          >
                            <div className="px-2 py-1 text-[10px] text-slate-300 truncate">{clip.name}</div>
                            {editMode === 'SPECTROGRAM' ? (
                              <SpectrogramEditor clip={clip} tool={spectrogramTool} />
                            ) : (
                              <PianoRoll clip={clip} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-10 border-t border-slate-700 bg-naw-panel flex items-center px-4 gap-2 shrink-0">
                <button
                  onClick={() => setEditMode('SPECTROGRAM')}
                  className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 ${editMode === 'SPECTROGRAM' ? 'bg-naw-accent text-naw-bg' : 'text-slate-400 hover:text-white'}`}
                >
                  <Activity size={12} /> Spectrogram
                </button>
                <button
                  onClick={() => setEditMode('PIANO_ROLL')}
                  className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 ${editMode === 'PIANO_ROLL' ? 'bg-naw-accent text-naw-bg' : 'text-slate-400 hover:text-white'}`}
                >
                  <Piano size={12} /> Piano Roll
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setSpectrogramTool(t => ({ ...t, mode: t.mode === 'BRUSH' ? 'SELECT' : 'BRUSH' }))}
                    className={`p-1.5 rounded ${spectrogramTool.mode === 'BRUSH' ? 'bg-naw-danger text-white' : 'text-slate-400 hover:text-white'}`}
                    title="Brush tool for inpainting"
                  >
                    <Brush size={14} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              <div className="flex gap-4 h-full items-end">
                {project.tracks.map(track => (
                  <MixerChannel
                    key={track.id}
                    track={track}
                    onUpdate={(updates) => handleTrackUpdate(track.id, updates)}
                    isSelected={selectedTrackId === track.id}
                    onSelect={() => setSelectedTrackId(track.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="h-8 border-t border-slate-700 bg-naw-panel flex items-center justify-between px-4 text-[10px] text-slate-500 shrink-0">
        <div className="flex items-center gap-4">
          <span>Stems: {project.tracks.length}</span>
          <span>Clips: {project.tracks.reduce((acc, t) => acc + t.clips.length, 0)}</span>
          <span>BPM: {project.bpm}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Cpu size={10} className="text-naw-accent" />
            <span>GPU: Neural Engine Active</span>
          </span>
          <span className={workletReady ? 'text-naw-success' : 'text-slate-600'}>
            Worklet: {workletReady ? 'Ready' : 'Idle'}
          </span>
          <span className={midiReady ? 'text-naw-success' : 'text-slate-600'}>
            MIDI: {midiReady ? `${midiDevices.length} dev` : 'Off'}
          </span>
          {workletReady && (
            <span className="font-mono">
              L:{meter.rmsL.toFixed(2)} R:{meter.rmsR.toFixed(2)}
            </span>
          )}
          <span className="text-slate-600">v1.3 — Style-Aware Generation</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
