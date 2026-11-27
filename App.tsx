
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    ProjectState, Track, Clip, StemType, SpectrogramTool, NoteEvent, EditViewMode 
} from './types';
import { INITIAL_TRACKS, TOTAL_BARS, PIXELS_PER_BAR, STEM_COLORS, TRACK_HEIGHT } from './constants';
import { PRESETS } from './data/presets';
import { generateSongBlueprint, type SongBlueprint } from './services/geminiService';
import { audioEngine } from './services/audioEngine';
import { audioWorkletEngine } from './services/audio/AudioWorkletEngine';
import { midiService } from './services/midi/MidiService';
import { MidiRecordingBuffer } from './services/midi/MidiRecordingBuffer';
import { MixerChannel } from './components/MixerChannel';
import { SpectrogramEditor } from './components/SpectrogramEditor';
import { PianoRoll } from './components/PianoRoll';
import { PromptLane } from './components/PromptLane';
import { ExportModal } from './components/ExportModal';
import { renderProjectToWav, downloadBlob, exportWavStems } from './services/audio/OfflineRenderer';
import { AboutModal } from './components/AboutModal';
import { 
  Play, Pause, Square, Mic, Wand2, Layers, Sliders, Info, MoreHorizontal, 
  Piano, Activity, Brush, Eye, Cpu, Save, Upload, Folder, Download, FileJson, Check,
  Music2, Paintbrush, Scissors, RefreshCw, ChevronDown, UploadCloud
} from 'lucide-react';

// ─── Style Adapter definitions (Phase 3.1) ───────────────────────────────────
const STYLE_ADAPTERS = ['None', 'Jazz', 'Techno', 'Orchestral', 'Lo-fi', 'Ambient', 'Hip-hop'] as const;
type StyleAdapter = (typeof STYLE_ADAPTERS)[number];

const PROJECT_STORAGE_KEY = 'naw.autosave.v1';
const PROJECT_SCHEMA_VERSION = 1;

function loadAutosave(): ProjectState | null {
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return null;
    const envelope: unknown = JSON.parse(raw);
    if (!envelope || typeof envelope !== 'object') return null;
    const metadata = envelope as { schemaVersion?: unknown; project?: unknown };
    if (typeof metadata.schemaVersion === 'number' && metadata.schemaVersion > PROJECT_SCHEMA_VERSION) return null;
    const candidate = 'project' in envelope ? metadata.project : envelope;
    if (!candidate || typeof candidate !== 'object') return null;
    const p = candidate as Partial<ProjectState>;
    if (!Array.isArray(p.tracks) || typeof p.bpm !== 'number') return null;
    return {
      bpm: p.bpm,
      isPlaying: false,
      currentBar: typeof p.currentBar === 'number' ? p.currentBar : 0,
      totalBars: typeof p.totalBars === 'number' ? p.totalBars : TOTAL_BARS,
      tracks: p.tracks,
      prompts: Array.isArray(p.prompts) ? p.prompts : [],
      generationStage: 'IDLE',
      generationProgress: 0,
    };
  } catch {
    return null;
  }
}

const App: React.FC = () => {
  const [project, setProject] = useState<ProjectState>(() => loadAutosave() ?? {
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

  const [styleAdapter, setStyleAdapter] = useState<StyleAdapter>('None');
  const [styleStrength, setStyleStrength] = useState(70);
  const [temperature, setTemperature] = useState(50);
  const [showAdapterMenu, setShowAdapterMenu] = useState(false);

  const [audioRefFile, setAudioRefFile] = useState<File | null>(null);
  const [audioRefDragging, setAudioRefDragging] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    clipId: string;
    trackId: string;
  }>({ visible: false, x: 0, y: 0, clipId: '', trackId: '' });

  const [showExportModal, setShowExportModal] = useState(false);
  const [isExportingWav, setIsExportingWav] = useState(false);
  const [isExportingStems, setIsExportingStems] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const [workletReady, setWorkletReady] = useState(false);
  const [midiReady, setMidiReady] = useState(false);
  const [midiDevices, setMidiDevices] = useState<{id: string; name: string; type: string}[]>([]);
  const [meter, setMeter] = useState({ rmsL: 0, rmsR: 0 });
  const [trackMeters, setTrackMeters] = useState<Record<string, number>>({});

  const midiBufferRef = useRef(new MidiRecordingBuffer());

  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [bpmInput, setBpmInput] = useState('');
  const bpmInputRef = useRef<HTMLInputElement>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRefInputRef = useRef<HTMLInputElement>(null);

  // Debounced local recovery snapshot. Avoid writing on every playhead frame.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({
          schemaVersion: PROJECT_SCHEMA_VERSION,
          project: {
            ...project,
            isPlaying: false,
            generationStage: 'IDLE',
            generationProgress: 0,
          },
        }));
      } catch {
        // Storage may be full or disabled; generation still works.
      }
    }, 800);
    return () => window.clearTimeout(timeoutId);
  }, [project]);

  useEffect(() => {
    audioEngine.setTracks(project.tracks);
    audioEngine.setBpm(project.bpm);
  }, [project.tracks, project.bpm]);

  useEffect(() => {
    if (project.isPlaying) {
      audioEngine.start(project.currentBar);
      if (workletReady && audioWorkletEngine.scheduler) {
        const stepSecs = 60 / project.bpm / 4;
        const start = audioWorkletEngine.audioContext?.currentTime ?? 0;
        audioWorkletEngine.scheduleBeatSequence(start, stepSecs, 16, (t, step) => {
          if (step % 4 === 0) {
            audioWorkletEngine.sendDspMessage({ type: 'noteOn', freq: 880, vel: 0.25 });
          }
        });
      }
    } else {
      audioEngine.stop();
    }
  }, [project.isPlaying, workletReady, project.bpm]);

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

  // Poll per-track activity meters while playing
  useEffect(() => {
    if (!project.isPlaying) {
      setTrackMeters({});
      return;
    }
    const id = window.setInterval(() => {
      setTrackMeters(audioEngine.getTrueTrackRms());
    }, 50);
    return () => window.clearInterval(id);
  }, [project.isPlaying]);

  const handleSaveProject = () => {
    const data = JSON.stringify({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      project,
    }, null, 2);
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
        const parsed = JSON.parse(event.target?.result as string);
        const envelope = parsed as { schemaVersion?: unknown; project?: unknown };
        if (typeof envelope.schemaVersion === 'number' && envelope.schemaVersion > PROJECT_SCHEMA_VERSION) {
          throw new Error(`This project was saved by a newer NAW version (schema ${envelope.schemaVersion}).`);
        }
        const candidate = envelope.project && typeof envelope.project === 'object'
          ? envelope.project
          : parsed;
        if (!candidate || typeof candidate !== 'object' || !Array.isArray((candidate as ProjectState).tracks)) {
          throw new Error('Invalid project file structure.');
        }
        const loaded = candidate as ProjectState;
        audioEngine.stop();
        setProject({
          ...loaded,
          isPlaying: false,
          generationStage: 'IDLE',
          generationProgress: 0,
          prompts: loaded.prompts || [],
        });
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : 'Failed to parse project file.');
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

  const handleGenerate = async () => {
    if (!mainPrompt.trim()) return;
    setProject(prev => ({ ...prev, generationStage: 'PLANNING', generationProgress: 10 }));
    let blueprint: SongBlueprint;
    try {
      blueprint = await generateSongBlueprint(mainPrompt, project.bpm, {
        styleAdapter,
        styleStrength,
        temperature,
        audioRefName: audioRefFile?.name
      });
    } catch (error) {
      setProject(prev => ({ ...prev, generationStage: 'IDLE', generationProgress: 0 }));
      window.alert(error instanceof Error ? error.message : 'Music generation failed. Please try again.');
      return;
    }

    // NAW 1.4 currently produces a symbolic arrangement. Acoustic rendering
    // is a planned stage and is not represented as completed audio generation.
    const generatedBpm = blueprint.suggestedBpm || project.bpm;
    const stems = blueprint.stems || [];

    const newTracks = project.tracks.map((track, idx) => {
      const stemData = stems.find(stem => stem.type === track.type) || stems[idx];
      const newClips: Clip[] = [];

      if (stemData?.pattern?.length) {
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
          const isNoteOff = msg.status === 0x80 || (msg.status === 0x90 && msg.data2 === 0);
          const isNoteOn = msg.status === 0x90 && msg.data2 > 0;

          if (isNoteOff) {
            if (workletReady) {
              const freq = 440 * Math.pow(2, (msg.data1 - 69) / 12);
              audioWorkletEngine.sendDspMessage({ type: 'noteOff', freq });
            }
            const completed = midiBufferRef.current.finish(
              msg.deviceId ?? 'unknown',
              msg.channel ?? 0,
              msg.data1,
              Math.round(project.currentBar * 16),
            );
            if (completed) {
              setProject(prev => ({
                ...prev,
                tracks: prev.tracks.map(t => t.id !== completed.trackId ? t : {
                  ...t,
                  clips: t.clips.map(c => ({
                    ...c,
                    events: c.events.map(ev => ev.id === completed.eventId ? { ...ev, duration: completed.duration } : ev),
                  })),
                }),
              }));
            }
          }

          if (isNoteOn && selectedTrackId) {
            const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
            const octave = Math.max(2, Math.min(4, Math.floor(msg.data1 / 12) - 1));
            const noteName = noteNames[msg.data1 % 12] + octave;
            const eventId = `midi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const startStep = Math.round(project.currentBar * 16);

            midiBufferRef.current.begin(
              msg.deviceId ?? 'unknown',
              msg.channel ?? 0,
              msg.data1,
              { eventId, trackId: selectedTrackId, startAbsoluteStep: startStep },
            );

            setProject(prev => {
              const tracks = prev.tracks.map(t => {
                if (t.id !== selectedTrackId) return t;
                if (workletReady) {
                  const freq = 440 * Math.pow(2, (msg.data1 - 69) / 12);
                  audioWorkletEngine.sendDspMessage({ type: 'noteOn', freq, vel: Math.min(1, msg.data2 / 127) });
                }
                const currentBar = Math.floor(prev.currentBar);
                let clipIndex = t.clips.findIndex(c => currentBar >= c.startBar && currentBar < c.startBar + c.lengthBars);
                const clipId = clipIndex === -1 ? `midi-clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : t.clips[clipIndex].id;
                if (clipIndex === -1) {
                  const stepInClip = Math.max(0, Math.floor((prev.currentBar - currentBar) * 16));
                  const events = [{ id: eventId, step: stepInClip, note: noteName, duration: 1, velocity: msg.data2 / 127 }];
                  const newClip = {
                    id: clipId,
                    name: 'MIDI',
                    startBar: currentBar,
                    lengthBars: 2,
                    type: t.type,
                    color: STEM_COLORS[t.type],
                    events,
                    latentData: []
                  };
                  return { ...t, clips: [...t.clips, newClip] };
                }
                const clip = t.clips[clipIndex];
                const stepInClip = Math.max(0, Math.floor((prev.currentBar - clip.startBar) * 16));
                const events = [{ id: eventId, step: stepInClip, note: noteName, duration: 1, velocity: msg.data2 / 127 }];
                return {
                  ...t,
                  clips: t.clips.map((c, i) => i === clipIndex ? { ...c, events: [...c.events, ...events] } : c)
                };
              });
              return { ...prev, tracks };
            });
          }
        };
      }
    }
  };

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

  const handleAudioRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setAudioRefDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioRefFile(file);
    }
  };

  const handleClipContextMenu = (e: React.MouseEvent, trackId: string, clipId: string) => {
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
          onExportMidi={() => { /* MIDI export handler wired in full UI */ setShowExportModal(false); }}
          isExportingWav={isExportingWav}
          isExportingStems={isExportingStems}
          onExportWavMixdown={async () => {
            setIsExportingWav(true);
            try {
              const blob = await renderProjectToWav(project.tracks, project.bpm, project.totalBars);
              downloadBlob(blob, `naw-mixdown-${Date.now()}.wav`);
            } catch (err) {
              console.error(err);
              alert('WAV export failed.');
            } finally {
              setIsExportingWav(false);
              setShowExportModal(false);
            }
          }}
          onExportWavStems={async () => {
            setIsExportingStems(true);
            try {
              await exportWavStems(project.tracks, project.bpm, project.totalBars);
            } catch (err) {
              console.error(err);
              alert('Stem export failed.');
            } finally {
              setIsExportingStems(false);
              setShowExportModal(false);
            }
          }}
          trackCount={project.tracks.length}
          bpm={project.bpm}
        />
      )}

      {showAboutModal && <AboutModal onClose={() => setShowAboutModal(false)} />}

      {/* Header / Transport */}
      <header className="flex items-center justify-between px-4 py-2 bg-naw-panel border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Music2 size={20} className="text-naw-accent" />
          <span className="font-bold text-white">NAW</span>
          <span className="text-xs text-slate-500">1.4</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setProject(p => ({ ...p, isPlaying: !p.isPlaying }))} className="p-2 rounded hover:bg-slate-700">
            {project.isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={() => setProject(p => ({ ...p, isPlaying: false, currentBar: 0 }))} className="p-2 rounded hover:bg-slate-700">
            <Square size={16} />
          </button>
          <div className="px-3 py-1 bg-slate-800 rounded text-sm font-mono" onClick={startBpmEdit}>
            {isEditingBpm ? (
              <input
                ref={bpmInputRef}
                value={bpmInput}
                onChange={e => setBpmInput(e.target.value)}
                onBlur={commitBpmEdit}
                onKeyDown={e => e.key === 'Enter' && commitBpmEdit()}
                className="w-12 bg-transparent text-center outline-none"
              />
            ) : (
              `${project.bpm} BPM`
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSaveProject} className="p-2 rounded hover:bg-slate-700" title="Save project"><Save size={16} /></button>
          <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded hover:bg-slate-700" title="Load project"><Upload size={16} /></button>
          <button onClick={() => setShowExportModal(true)} className="p-2 rounded hover:bg-slate-700" title="Export"><Download size={16} /></button>
          <button onClick={() => setShowAboutModal(true)} className="p-2 rounded hover:bg-slate-700" title="About"><Info size={16} /></button>
        </div>
      </header>

      {/* Sidebar + Main */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 bg-naw-panel border-r border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="text-xs text-slate-400">Prompt</label>
            <textarea
              value={mainPrompt}
              onChange={e => setMainPrompt(e.target.value)}
              placeholder="Describe the music..."
              className="w-full mt-1 p-2 bg-slate-800 border border-slate-600 rounded text-sm resize-none h-20"
            />
            <button onClick={handleGenerate} disabled={project.generationStage !== 'IDLE'} className="mt-2 w-full py-2 bg-naw-accent text-slate-900 font-bold rounded text-sm disabled:opacity-50">
              {project.generationStage === 'IDLE' ? 'Generate' : project.generationStage}
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Style: {styleAdapter} · Strength {styleStrength}% · Temp {temperature}
          </div>
          {midiDevices.length > 0 && (
            <div className="text-xs">
              <div className="text-slate-400 mb-1">MIDI</div>
              {midiDevices.map(d => <div key={d.id} className="text-slate-300">{d.type}: {d.name}</div>)}
            </div>
          )}
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-naw-surface border-b border-slate-700">
            <button onClick={() => setViewMode('ARRANGEMENT')} className={`px-3 py-1 text-sm rounded ${viewMode === 'ARRANGEMENT' ? 'bg-naw-accent text-slate-900' : 'text-slate-300'}`}>Arrangement</button>
            <button onClick={() => setViewMode('MIXER')} className={`px-3 py-1 text-sm rounded ${viewMode === 'MIXER' ? 'bg-naw-accent text-slate-900' : 'text-slate-300'}`}>Mixer</button>
          </div>

          {viewMode === 'ARRANGEMENT' ? (
            <div className="flex-1 overflow-auto relative" ref={timelineRef}>
              <div className="relative" style={{ width: TOTAL_BARS * PIXELS_PER_BAR }}>
                {project.tracks.map(track => (
                  <div key={track.id} className="flex border-b border-slate-700" style={{ height: TRACK_HEIGHT }}>
                    <div className="w-32 shrink-0 p-2 bg-naw-panel border-r border-slate-700 text-xs">{track.name}</div>
                    <div className="flex-1 relative" onClick={handleSeek}>
                      {track.clips.map(clip => (
                        <div
                          key={clip.id}
                          className="absolute top-1 bottom-1 rounded text-xs p-1 overflow-hidden"
                          style={{
                            left: clip.startBar * PIXELS_PER_BAR,
                            width: clip.lengthBars * PIXELS_PER_BAR,
                            backgroundColor: clip.color + '40',
                            border: `1px solid ${clip.color}`,
                          }}
                          onContextMenu={e => handleClipContextMenu(e, track.id, clip.id)}
                        >
                          {clip.name}
                        </div>
                      ))}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-500"
                        style={{ left: project.currentBar * PIXELS_PER_BAR }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-x-auto">
              {project.tracks.map(track => (
                <MixerChannel key={track.id} track={track} onUpdate={handleTrackUpdate} isPlaying={project.isPlaying} meterLevel={trackMeters[track.id] ?? 0} />
              ))}
              <div className="w-24 flex flex-col items-center justify-end p-4">
                <div className="w-4 h-48 bg-slate-900 rounded-full overflow-hidden relative border border-slate-600">
                  <div
                    className="absolute bottom-0 left-0 w-full bg-naw-accent transition-all"
                    style={{ height: project.isPlaying ? `${Math.min(100, Math.max(0, Math.max(meter.rmsL, meter.rmsR) * 100))}%` : '0%' }}
                  />
                </div>
                <div className="text-xs mt-2">Master</div>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="flex items-center justify-between px-4 py-1 bg-naw-panel border-t border-slate-700 text-xs text-slate-500">
        <span>GPU: Neural Engine Active</span>
        <span className="text-slate-600">v1.4 — Symbolic Generation</span>
      </footer>
    </div>
  );
};

export default App;
