# NAW API Documentation

> **Service Layer API Reference for Neural Audio Workstation**

This document describes the public API of NAW's service layer modules. These services encapsulate the business logic for AI generation and audio playback.

---

## Table of Contents

1. [Gemini Service](#gemini-service)
2. [Audio Engine](#audio-engine)
3. [Future APIs](#future-apis)

---

## Gemini Service

**Module**: `services/geminiService.ts` (client) + `api/generate-blueprint.ts` (server)  
**Purpose**: AI-powered semantic planning (Stage 1 of hybrid architecture)

As of v1.4 the Gemini call is **server-side**. The client never receives the `GEMINI_API_KEY`.

### Endpoint: `POST /api/generate-blueprint`

**Request body:**
```json
{
  "prompt": "Uplifting house track with deep bass",
  "bpm": 128,
  "options": {
    "styleAdapter": "Techno",
    "styleStrength": 0.7,
    "temperature": 0.8,
    "audioRefName": "optional-reference.wav"
  }
}
```

**Rate limiting (v1.6):** 10 requests per minute per client (in-memory, best-effort on serverless).  
**Optional auth:** Set `NAW_API_KEY` in the environment and send `X-API-Key` header.  
**Response headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` (on 429).

**Error responses:**
- `400` – invalid prompt or BPM
- `401` – missing/invalid API key (when `NAW_API_KEY` is set)
- `429` – rate limit exceeded
- `500` – missing `GEMINI_API_KEY` or provider error

### Client function: `generateSongBlueprint`

Generates a musical blueprint (2-bar loop patterns for 4 stems) via the server endpoint.

**Signature:**
```typescript
async function generateSongBlueprint(
  prompt: string, 
  bpm: number,
  options?: GenerationOptions
): Promise<SongBlueprint>
```

**Parameters:**
- `prompt` (string): High-level musical description
  - Example: `"Uplifting house track, 128 BPM, energetic"`
- `bpm` (number): Desired tempo (used as a hint, may be overridden by AI)

**Returns:** `Promise<SongBlueprint>`

**SongBlueprint Interface:**
```typescript
interface SongBlueprint {
  title: string;              // AI-generated song title
  suggestedBpm: number;       // Recommended tempo
  stems: StemBlueprint[];     // Array of 4 stem patterns
}

interface StemBlueprint {
  type: "DRUMS" | "BASS" | "VOCALS" | "OTHER";
  description: string;        // Short description of the pattern
  pattern: NoteEvent[];       // Array of musical events
}

interface NoteEvent {
  step: number;               // 16th-note step (0-31 for 2 bars)
  note: string | number;      // "KICK", "C#3", or MIDI number
  duration: number;           // Duration in steps
  velocity: number;           // 0.0-1.0
}
```

**Example:**
```typescript
import { generateSongBlueprint } from './services/geminiService';

const blueprint = await generateSongBlueprint("Dark techno, 130 BPM", 130);

console.log(blueprint.title);           // "Dark Techno Groove"
console.log(blueprint.suggestedBpm);    // 132 (AI may adjust)
console.log(blueprint.stems.length);    // 4 (DRUMS, BASS, VOCALS, OTHER)
console.log(blueprint.stems[0].pattern[0]); 
// { step: 0, note: "KICK", duration: 1, velocity: 1.0 }
```

**Error Handling:**
- **Missing API Key**: Server returns 500 if `GEMINI_API_KEY` is unset
- **Network/API Failure**: Returns fallback pattern (basic 4/4 drums + bass)
- **Invalid JSON**: Attempts cleanup, falls back if parsing fails
- **Rate limit**: 429 with `Retry-After` header

**Environment Variables:**
- `GEMINI_API_KEY`: Required on the server (never exposed to the browser)
- `NAW_API_KEY`: Optional. When set, clients must send `X-API-Key` header

---

## Audio Engine

**Module**: `services/audioEngine.ts`  
**Purpose**: Web Audio API wrapper for playback simulation

### Instance

The module exports a singleton instance:

```typescript
import { audioEngine } from './services/audioEngine';
```

### Methods

#### `setTracks`

Updates the track data reference for playback.

**Signature:**
```typescript
setTracks(tracks: Track[]): void
```

**Parameters:**
- `tracks` (Track[]): Array of 4 tracks from project state

**Example:**
```typescript
audioEngine.setTracks(project.tracks);
```

---

#### `setBpm`

Updates the tempo.

**Signature:**
```typescript
setBpm(bpm: number): void
```

**Parameters:**
- `bpm` (number): Beats per minute (60-240 typical range)

**Example:**
```typescript
audioEngine.setBpm(128);
```

---

#### `start`

Starts playback from a specified bar position.

**Signature:**
```typescript
start(startBar?: number): void
```

**Parameters:**
- `startBar` (number, optional): Bar position to start from (default: 0)

**Example:**
```typescript
// Start from beginning
audioEngine.start();

// Start from bar 16 (middle of 32-bar project)
audioEngine.start(16);
```

**Side Effects:**
- Initializes Web Audio context
- Starts scheduler loop
- Sets `isPlaying` to `true`

---

#### `stop`

Stops playback and cancels the scheduler.

**Signature:**
```typescript
stop(): void
```

**Example:**
```typescript
audioEngine.stop();
```

**Side Effects:**
- Sets `isPlaying` to `false`
- Clears scheduler timer
- Does NOT reset playhead (use `start(0)` to reset)

---

#### `getCurrentBar`

Returns the current playhead position in bars.

**Signature:**
```typescript
getCurrentBar(): number
```

**Returns:** `number` - Current bar position (float for sub-bar precision)

**Example:**
```typescript
const position = audioEngine.getCurrentBar();
console.log(position); // 8.5 (bar 8, beat 3)
```

**Notes:**
- Returns `startBar` if not playing
- Uses AudioContext's high-precision clock (sample-accurate)

---

#### `getTrueTrackRms` (v1.6)

Returns true RMS levels (0–1) from per-track AnalyserNodes.

**Signature:**
```typescript
getTrueTrackRms(): Record<string, number>
```

**Example:**
```typescript
const levels = audioEngine.getTrueTrackRms();
// { t1: 0.42, t2: 0.18, ... }
```

---

#### `getTrackMeterLevels` (v1.5, fallback)

Returns decaying activity levels from note triggers. Used as fallback when analysers are not yet created.

**Signature:**
```typescript
getTrackMeterLevels(): Record<string, number>
```

---

### Properties

#### `isPlaying`

**Type:** `boolean`  
**Description:** Current playback state  
**Read-only** (use `start()`/`stop()` to change)

#### `bpm`

**Type:** `number`  
**Description:** Current tempo in BPM  
**Default:** `120`

#### `ctx`

**Type:** `AudioContext | null`  
**Description:** Web Audio API context  
**Read-only**

---

### Internal Methods (Private)

These methods are implementation details and should not be called directly:

- `init()` - Initializes audio context and master chain
- `scheduler()` - Look-ahead timing loop
- `scheduleNote()` - Schedules events in lookahead window
- `playClipEvents()` - Triggers events from a clip
- `triggerEvent()` - Routes event to appropriate synthesis function
- `playKick()`, `playSnare()`, `playHiHat()`, etc. - Audio synthesis
- `getTrackAnalyser()` - Creates/retrieves per-track AnalyserNode
- `bumpTrackMeter()` - Updates activity-based meter

---

## Offline Renderer (v1.6)

**Module**: `services/audio/OfflineRenderer.ts`  
**Purpose**: Render current symbolic patterns to WAV using OfflineAudioContext

### Functions

#### `renderProjectToWav`

```typescript
async function renderProjectToWav(
  tracks: Track[],
  bpm: number,
  totalBars: number,
  sampleRate?: number
): Promise<Blob>
```

Renders prototype oscillator synthesis (not neural audio) to a WAV Blob.

#### `downloadBlob`

```typescript
function downloadBlob(blob: Blob, filename: string): void
```

Triggers a browser download of the given Blob.

---

## Future APIs

These APIs are planned but not yet implemented:

### Neural Codec Service (Phase 2)

```typescript
// services/codecService.ts

interface CodecService {
  // Encode audio to discrete tokens
  encode(audio: Float32Array): Promise<number[][]>;
  
  // Decode tokens to audio
  decode(tokens: number[][]): Promise<Float32Array>;
  
  // Get latent representation (unquantized)
  getLatents(audio: Float32Array): Promise<Float32Array>;
}
```

### Flow Matching Service (Phase 2)

```typescript
// services/flowMatchingService.ts

interface FlowMatchingService {
  // Render high-fidelity audio from semantic tokens
  render(
    semanticTokens: number[][],
    textEmbedding: Float32Array,
    steps?: number
  ): Promise<Float32Array>;
  
  // Inpaint a masked region
  inpaint(
    audio: Float32Array,
    mask: boolean[],
    textEmbedding: Float32Array
  ): Promise<Float32Array>;
}
```

### ControlNet Service (Phase 3)

```typescript
// services/controlnetService.ts

interface ControlNetService {
  // Apply control adapter to generation
  applyControl(
    generation: Float32Array,
    controlSignal: ControlSignal,
    strength: number
  ): Promise<Float32Array>;
}

interface ControlSignal {
  type: 'melody' | 'rhythm' | 'dynamics' | 'audio_reference';
  data: Float32Array | number[];
}
```

---

## Type Reference

For complete type definitions, see:
- **`types.ts`**: Core data structures (Track, Clip, NoteEvent, etc.)
- **`constants.ts`**: Configuration values

---

## Error Codes

### Gemini Service

| Code | Description | Recovery |
|------|-------------|----------|
| `API_KEY_MISSING` | No `GEMINI_API_KEY` on server | Set environment variable on the server |
| `RATE_LIMITED` | 10 requests/minute exceeded | Wait for `Retry-After` |
| `UNAUTHORIZED` | `NAW_API_KEY` set but header missing/invalid | Send `X-API-Key` header |
| `JSON_PARSE_ERROR` | Invalid JSON response | Uses fallback pattern |
| `NETWORK_ERROR` | API request failed | Uses fallback pattern |

### Audio Engine

| Code | Description | Recovery |
|------|-------------|----------|
| `CONTEXT_BLOCKED` | AudioContext suspended (autoplay policy) | User interaction required |
| `NO_CONTEXT` | AudioContext not supported | Use modern browser |

---

## Performance Considerations

### Gemini Service
- **Latency**: 2-5 seconds per request
- **Rate Limits**: Gemini API has rate limits (check quota)
- **Caching**: Consider caching responses for repeated prompts

### Audio Engine
- **Scheduler Precision**: Uses 25ms lookahead window
- **Synthesis Load**: Simple oscillators, minimal CPU usage
- **Memory**: ~10MB for audio buffers and nodes

---

## Examples

### Complete Generation Flow

```typescript
import { generateSongBlueprint } from './services/geminiService';
import { audioEngine } from './services/audioEngine';

async function generateAndPlay() {
  // 1. Generate blueprint
  const blueprint = await generateSongBlueprint("Epic orchestral", 120);
  
  // 2. Convert blueprint to tracks
  const tracks = convertBlueprintToTracks(blueprint);
  
  // 3. Load into audio engine
  audioEngine.setTracks(tracks);
  audioEngine.setBpm(blueprint.suggestedBpm);
  
  // 4. Start playback
  audioEngine.start(0);
  
  // 5. Monitor progress
  setInterval(() => {
    const bar = audioEngine.getCurrentBar();
    console.log(`Bar ${Math.floor(bar) + 1}`);
  }, 1000);
}
```

### Seeking During Playback

```typescript
// Jump to bar 16
audioEngine.stop();
audioEngine.start(16);
```

### Solo/Mute Tracks

```typescript
// Solo the drums track
const newTracks = tracks.map(t => ({
  ...t,
  solo: t.type === StemType.DRUMS
}));

audioEngine.setTracks(newTracks);
```

---

## Version History

- **v1.6.0**: True per-track RMS metering, synthesized WAV mixdown export, API rate limiting + optional key
- **v1.5.0**: Per-track activity metering
- **v1.4.0**: Server-side Gemini, stabilization review
- **v1.1.0**: Gemini integration, basic playback
- **v1.0.0**: Initial prototype with static patterns

---

**Last Updated**: January 15, 2025  
**Maintainer**: @GizzZmo
