# Neural Audio Workstation (NAW) - Architecture Documentation

> **Technical Deep Dive: System Design, Data Flow, and Implementation Details**

## Table of Contents

1. [System Overview](#system-overview)
2. [Architectural Patterns](#architectural-patterns)
3. [Component Hierarchy](#component-hierarchy)
4. [Data Flow](#data-flow)
5. [Core Modules](#core-modules)
6. [AI/ML Pipeline](#aiml-pipeline)
7. [Future Architecture](#future-architecture)
8. [Performance Considerations](#performance-considerations)

---

## System Overview

NAW is a **hybrid web application** built with React and TypeScript, designed to simulate and eventually implement a production-grade AI music workstation. The architecture follows a **two-stage generative pipeline** inspired by state-of-the-art research in audio synthesis.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE (React)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Timeline   │  │    Mixer     │  │  Spectrogram │          │
│  │     View     │  │     View     │  │    Editor    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                             ↕ (React State)
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION STATE                            │
│  • Project State (BPM, Tracks, Clips, Prompts)                  │
│  • Playback State (isPlaying, currentBar)                       │
│  • UI State (selectedTrack, viewMode, editMode)                 │
└─────────────────────────────────────────────────────────────────┘
                             ↕
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                               │
│  ┌──────────────────┐           ┌──────────────────┐           │
│  │ Gemini Service   │           │  Audio Engine    │           │
│  │ (AI Generation)  │           │  (Web Audio API) │           │
│  └──────────────────┘           └──────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                             ↕
┌─────────────────────────────────────────────────────────────────┐
│                  EXTERNAL DEPENDENCIES                           │
│  • Gemini 2.5 Flash API (Semantic Planning)                     │
│  • Web Audio API (Playback Simulation)                          │
│  • Browser Storage (Project Persistence)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architectural Patterns

### 1. Unidirectional Data Flow (Flux/Redux-like)

NAW uses **React Hooks** (`useState`, `useEffect`) to manage state in a unidirectional flow:

```
User Action → State Update → Re-render Components → Side Effects
      ↑_________________________________________________________↓
                    (Feedback Loop via Audio Engine)
```

**Example Flow:**
1. User clicks "Play" button
2. `setProject({ ...project, isPlaying: true })` updates state
3. `useEffect` detects change, calls `audioEngine.start()`
4. Audio engine updates `currentBar` via `requestAnimationFrame`
5. Component re-renders with new playhead position

### 2. Separation of Concerns

- **Components**: Pure UI rendering (no business logic)
- **Services**: Encapsulated logic for AI and audio
- **Types**: Strict TypeScript interfaces for data contracts
- **Constants**: Configuration and magic numbers isolated

### 3. Composition Over Inheritance

React components are **composed** rather than extended:
```tsx
<App>
  <Header>
    <TransportControls />
    <ViewSwitcher />
  </Header>
  <Sidebar>
    <PromptInput />
    <ToolSettings />
  </Sidebar>
  <Timeline>
    {tracks.map(track => (
      <Track>
        {track.clips.map(clip => (
          <Clip>
            {editMode === 'SPECTROGRAM' ? <SpectrogramEditor /> : <PianoRoll />}
          </Clip>
        ))}
      </Track>
    ))}
  </Timeline>
</App>
```

---

## Component Hierarchy

### Root Component: `App.tsx`

**Responsibilities:**
- Owns all global state (`ProjectState`)
- Manages playback lifecycle
- Routes user actions to services
- Renders layout and child components

**Key State:**
```typescript
interface ProjectState {
  bpm: number;                    // Tempo
  isPlaying: boolean;             // Transport state
  currentBar: number;             // Playhead position (float for sub-bar precision)
  totalBars: number;              // Project length
  tracks: Track[];                // Array of 4 stems
  prompts: PromptKeyframe[];      // Temporal style changes
  generationStage: 'IDLE' | 'PLANNING' | 'RENDERING' | 'COMPLETED';
  generationProgress: number;     // 0-100%
}
```

---

### UI Components

#### 1. `MixerChannel.tsx`
**Purpose:** Single channel strip in mixer view

**Props:**
```typescript
{
  track: Track;                   // Stem data
  onUpdate: (id, updates) => void; // Callback for volume/mute/solo changes
  isPlaying: boolean;             // For VU meter animation
}
```

**Features:**
- Volume fader (vertical slider)
- Solo/Mute toggles
- VU meter (simulated)
- Track name and color

---

#### 2. `SpectrogramEditor.tsx`
**Purpose:** Frequency-over-time visualization with inpainting tools

**Props:**
```typescript
{
  tool: SpectrogramTool;          // Brush/select mode, size, latent view toggle
  width: number;                  // Pixel width (lengthBars * PIXELS_PER_BAR)
  height: number;                 // Pixel height (TRACK_HEIGHT - header)
  isPlaying: boolean;             // For playhead animation
  currentBar: number;             // Playhead position within clip
  totalBars: number;              // Clip duration
  color: string;                  // Stem color for visualization
}
```

**Features:**
- Canvas-based rendering (2D context)
- Simulated spectrogram (colored noise pattern)
- Brush tool for masking (future: actual inpainting)
- Latent view toggle (future: show RVQ codebook indices)

**Rendering Logic:**
```typescript
// Simulated spectrogram: vertical colored bars
for (let i = 0; i < width; i++) {
  const barHeight = Math.random() * 0.7 + 0.3;
  const y = height * (1 - barHeight);
  ctx.fillStyle = color with opacity;
  ctx.fillRect(i, y, 1, height - y);
}
```

---

#### 3. `PianoRoll.tsx`
**Purpose:** MIDI-style note grid for melodic/harmonic visualization

**Props:**
```typescript
{
  clip: Clip;                     // Contains NoteEvent array
  width: number;
  height: number;
  isPlaying: boolean;
  currentBar: number;
}
```

**Features:**
- Horizontal grid: 16th-note steps
- Vertical grid: Pitch lanes (for melodic stems) or drum lanes (for percussion)
- Note rectangles positioned by `step`, `duration`, `velocity`
- Ghost notes (AI suggestions, faded out)

**Rendering Logic:**
```typescript
clip.events.forEach(event => {
  const x = (event.step / 16) * width;  // Convert step to pixel
  const w = (event.duration / 16) * width;
  const alpha = event.isGhost ? 0.3 : event.velocity;
  // Draw rectangle at (x, y, w, h) with alpha
});
```

---

#### 4. `PromptLane.tsx`
**Purpose:** Timeline lane for prompt keyframes

**Props:**
```typescript
{
  prompts: PromptKeyframe[];      // Array of { id, bar, text, timestamp }
  onAddPrompt: (bar: number) => void;
}
```

**Features:**
- Thin horizontal strip above tracks
- Markers at each keyframe position
- Tooltip shows prompt text on hover
- Click anywhere to add new keyframe

---

## Data Flow

### Generation Flow (Semantic Planner)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User enters prompt: "Uplifting house, 128 BPM, energetic" │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. App.tsx sets generationStage = 'PLANNING'                 │
│    Calls: generateSongBlueprint(prompt, bpm)                 │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. geminiService.ts sends request to Gemini 2.5 Flash        │
│    System Instruction: "Generate 2-bar loops for 4 stems"    │
│    Response Schema: { title, suggestedBpm, stems[] }         │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Parse JSON response (robust cleanup: remove markdown,     │
│    trailing commas, extract {...} substring)                 │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. App.tsx sets generationStage = 'RENDERING'                │
│    (Simulates Flow Matching stage with progress animation)   │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. Map blueprint stems to Track objects:                     │
│    - Create Clip for each stem (startBar, lengthBars, events)│
│    - Repeat clips to fill 32 bars                            │
│    - Update project.tracks                                   │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. Set generationStage = 'COMPLETED', progress = 100%        │
│    After 2s: Reset to 'IDLE'                                 │
└──────────────────────────────────────────────────────────────┘
```

**Error Handling:**
- If Gemini API fails or returns invalid JSON → Fallback to hardcoded pattern
- If API key missing → Throw error immediately

---

### Playback Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User clicks Play button                                   │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. setProject({ isPlaying: true })                           │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. useEffect detects isPlaying change                        │
│    Calls: audioEngine.start(currentBar)                      │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. audioEngine (Web Audio API simulation):                   │
│    - Schedules oscillators for each NoteEvent                │
│    - Starts internal timer based on BPM                      │
│    - Returns currentBar via getCurrentBar()                  │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. App.tsx animation loop (requestAnimationFrame):           │
│    - Polls audioEngine.getCurrentBar()                       │
│    - Updates project.currentBar                              │
│    - Re-renders playhead position                            │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. When currentBar >= totalBars:                             │
│    - setProject({ isPlaying: false, currentBar: 0 })         │
│    - Stop animation loop                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. `types.ts`

**Purpose:** TypeScript type definitions for type safety

**Key Types:**

```typescript
enum StemType {
  DRUMS = 'DRUMS',
  BASS = 'BASS',
  VOCALS = 'VOCALS',
  OTHER = 'OTHER'
}

interface NoteEvent {
  step: number;           // 0-63 (for 4 bars, 16th-note grid)
  note: string | number;  // "KICK", "C#3", or MIDI number
  duration: number;       // In steps
  velocity: number;       // 0.0-1.0
  isGhost?: boolean;      // AI suggestion (not committed)
}

interface Clip {
  id: string;
  name: string;
  startBar: number;       // Position on timeline
  lengthBars: number;     // Duration
  type: StemType;
  color: string;
  events: NoteEvent[];    // Musical content
  latentData: number[];   // Future: RVQ codebook indices
}

interface Track {
  id: string;
  name: string;
  type: StemType;
  volume: number;         // 0-1
  muted: boolean;
  solo: boolean;
  clips: Clip[];
}
```

---

### 2. `constants.ts`

**Purpose:** Configuration values (avoid magic numbers)

```typescript
export const TOTAL_BARS = 32;            // Project length
export const PIXELS_PER_BAR = 60;        // Timeline zoom level
export const TRACK_HEIGHT = 100;         // Pixels

export const INITIAL_TRACKS = [
  { id: 't1', name: 'Drums (stem)', type: StemType.DRUMS, ... },
  { id: 't2', name: 'Bass (stem)', type: StemType.BASS, ... },
  { id: 't3', name: 'Vocals (stem)', type: StemType.VOCALS, ... },
  { id: 't4', name: 'Other (stem)', type: StemType.OTHER, ... },
];

export const STEM_COLORS = {
  [StemType.DRUMS]: '#f87171',   // Red
  [StemType.BASS]: '#fbbf24',    // Amber
  [StemType.VOCALS]: '#38bdf8',  // Blue
  [StemType.OTHER]: '#a78bfa',   // Purple
};
```

---

### 3. `services/geminiService.ts`

**Purpose:** Interface to Gemini 2.5 Flash for semantic planning

**Architecture:**
- Uses `@google/genai` SDK
- Sends structured prompt with JSON schema
- Robust JSON parsing (handles markdown code blocks, trailing commas)
- Fallback to hardcoded pattern on failure

**Key Function:**
```typescript
export const generateSongBlueprint = async (prompt: string, bpm: number) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "Generate 2-bar loops for 4 stems...",
      responseMimeType: "application/json",
      responseSchema: { /* Structured schema */ }
    }
  });
  
  // Parse and validate response
  return blueprint;
};
```

---

### 4. `services/audioEngine.ts`

**Purpose:** Web Audio API wrapper for playback simulation

**Current Implementation (Placeholder):**
- Simple oscillator-based synthesis
- No real audio rendering (just timing simulation)
- Maintains internal clock based on BPM

**Future Implementation:**
- Load WAV files generated by neural vocoder
- Multi-track mixing with volume/pan controls
- Real-time effects (EQ, compression)

---

## AI/ML Pipeline

### Current: Simulation

```
Text Prompt → Gemini 2.5 Flash → JSON Blueprint → React State → UI
```

**Gemini's Role:**
- Acts as a **semantic planner proxy**
- Generates symbolic musical data (note events, not audio)
- Output: Step sequencer patterns for 4 stems

**Limitations:**
- No actual audio generation
- No latent space compression
- No diffusion rendering

---

### Future: Full Neural Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: SEMANTIC PLANNER (Autoregressive Transformer)      │
├─────────────────────────────────────────────────────────────┤
│ Input:  Text Prompt + BPM + Control Signals (MIDI/Rhythm)   │
│ Model:  Transformer-XL (300M-500M params)                    │
│ Output: Discrete Tokens (RVQ Codebooks 0-1, 50Hz rate)      │
│ Target: 2048 tokens (~40 seconds) in <2 seconds             │
└─────────────────────────────────────────────────────────────┘
                            ↓ (Tokens)
┌─────────────────────────────────────────────────────────────┐
│ CODEC LAYER: DAC (Descript Audio Codec)                     │
├─────────────────────────────────────────────────────────────┤
│ Encoder:  Audio → Continuous Latent → RVQ Tokens            │
│ Decoder:  Tokens → Continuous Latent → Audio                │
│ Config:   44.1kHz stereo, 8-16 codebooks                    │
│ Split:    Codebooks 0-1 = Semantic, 2-15 = Acoustic         │
└─────────────────────────────────────────────────────────────┘
                            ↓ (Semantic Tokens)
┌─────────────────────────────────────────────────────────────┐
│ STAGE 2: ACOUSTIC RENDERER (Flow Matching)                  │
├─────────────────────────────────────────────────────────────┤
│ Input:  Semantic Tokens + Text Embedding (CLAP)             │
│ Model:  DiT (Diffusion Transformer, ~1B params)              │
│ Output: Refined Tokens (Codebooks 2-15, high fidelity)      │
│ Steps:  10-20 denoising iterations                          │
│ Target: 32 bars in <10 seconds (RTX 3090)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓ (Full Token Set)
┌─────────────────────────────────────────────────────────────┐
│ VOCODER: DisCoder / Vocos                                   │
├─────────────────────────────────────────────────────────────┤
│ Input:  All RVQ Tokens                                      │
│ Output: 44.1kHz Stereo WAV                                  │
│ Mode:   Vocos (fast preview) or DisCoder (final render)     │
└─────────────────────────────────────────────────────────────┘
```

**Integration Points:**
- Stage 1 output → Visualize in Piano Roll (symbolic notes)
- Stage 2 output → Visualize in Spectrogram (latent codes)
- Vocoder output → Load into Web Audio API for playback

---

## Future Architecture

### VST/AU Plugin (JUCE C++)

```
┌─────────────────────────────────────────────────────────────┐
│ DAW (Ableton, Logic, etc.)                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ NAW Plugin (VST3/AU)                                │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │ UI (JUCE WebView, embedded React app)     │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │ Audio Thread (C++)                         │     │    │
│  │  │  - ONNX Runtime (model inference)          │     │    │
│  │  │  - TensorRT (GPU acceleration)             │     │    │
│  │  │  - Audio buffer management                 │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Key Challenges:**
- **Latency**: Must report lookahead to DAW (e.g., 4 bars)
- **Threading**: UI thread (React) separate from audio thread (DSP)
- **Model Loading**: Load .onnx/.neutone files at plugin init
- **Memory**: Keep models in GPU memory, minimize transfers

---

## Performance Considerations

### Current (Web App)

**Bottlenecks:**
- Gemini API latency (~2-5 seconds)
- JSON parsing (minimal overhead)
- Canvas rendering (re-paint on every frame)

**Optimizations:**
- Use `requestAnimationFrame` for smooth playhead
- Debounce slider inputs
- Lazy load components

---

### Future (Neural Pipeline)

**Bottlenecks:**
- Model inference time (Stage 1: ~2s, Stage 2: ~10s)
- GPU memory (models can be 1-5GB)
- Audio buffer underruns (if generation slower than playback)

**Optimizations:**
- **Quantization**: INT8 reduces model size 4x
- **TensorRT**: Fused kernels, 2-3x speedup
- **Asynchronous Generation**: Render ahead of playhead
- **Model Distillation**: Compress models with minimal quality loss
- **Streaming**: Generate audio in chunks (1-bar windows)

---

## Code Style & Conventions

### TypeScript
- **Strict mode**: All types explicitly defined
- **Enums** for fixed sets (e.g., `StemType`, `GenerationStage`)
- **Interfaces** for data structures (e.g., `Track`, `Clip`)

### React
- **Functional components** with hooks (no class components)
- **Prop drilling** for now (no global state library like Redux)
- **useEffect** for side effects (audio engine, animation loops)

### Naming
- **Components**: PascalCase (`SpectrogramEditor`)
- **Functions**: camelCase (`handleGenerate`)
- **Constants**: UPPER_SNAKE_CASE (`TOTAL_BARS`)
- **Files**: Match component name (`SpectrogramEditor.tsx`)

---

## Testing Strategy (Future)

### Unit Tests
- **Services**: Mock Gemini API responses, test JSON parsing edge cases
- **Audio Engine**: Test BPM calculations, bar position accuracy

### Integration Tests
- **Generation Flow**: End-to-end from prompt to UI update
- **Playback Flow**: Verify play/pause/stop state transitions

### Performance Tests
- **Render Time**: Measure component re-render duration
- **Memory Leaks**: Check for unmounted component cleanup

---

## Deployment

### Web App (Current)
- **Build**: `npm run build` → Static files in `dist/`
- **Host**: Vercel, Netlify, or any static host
- **API Key**: Injected via environment variable (`VITE_GEMINI_API_KEY`)

### Plugin (Future)
- **Build**: `cmake` + JUCE → VST3/AU binaries
- **Distribute**: Installer for Windows/macOS/Linux
- **Licensing**: iLok or custom DRM

---

## References

- **MusicGen**: https://arxiv.org/abs/2306.05284
- **Stable Audio**: https://arxiv.org/abs/2402.04825
- **DAC Codec**: https://arxiv.org/abs/2306.06546
- **Flow Matching**: https://arxiv.org/abs/2210.02747
- **ControlNet**: https://arxiv.org/abs/2302.05543

---

**Maintained by**: @GizzZmo  
**Last Updated**: January 15, 2025
