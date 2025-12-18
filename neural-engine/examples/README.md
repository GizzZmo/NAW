# Neural Engine Examples

This directory contains practical examples demonstrating how to use the Neural Audio Workstation's neural engine components.

## Running Examples

To run any example:

```bash
npx tsx neural-engine/examples/01-basic-generation.ts
```

Or add to your `package.json`:

```json
{
  "scripts": {
    "example:basic": "tsx neural-engine/examples/01-basic-generation.ts",
    "example:advanced": "tsx neural-engine/examples/02-advanced-pipeline.ts",
    "example:controlnet": "tsx neural-engine/examples/03-controlnet.ts",
    "example:inpainting": "tsx neural-engine/examples/04-inpainting.ts",
    "example:clap": "tsx neural-engine/examples/05-clap.ts"
  }
}
```

## Examples Overview

### 01 - Basic Generation
**File**: `01-basic-generation.ts`

The simplest way to generate music using the high-level `generateMusic()` API.

**Topics Covered:**
- Using `generateMusic()` for quick generation
- Quality presets (fast, balanced, high)
- Time estimation
- Basic stem output

**Run it:**
```bash
npx tsx neural-engine/examples/01-basic-generation.ts
```

---

### 02 - Advanced Pipeline Control
**File**: `02-advanced-pipeline.ts`

Fine-grained control over the three-stage generation pipeline.

**Topics Covered:**
- Manual component initialization
- Custom configuration for each stage
- Progress tracking
- Performance monitoring
- Detailed control over quality settings

**Run it:**
```bash
npx tsx neural-engine/examples/02-advanced-pipeline.ts
```

---

### 03 - ControlNet
**File**: `03-controlnet.ts`

Fine-grained control over specific musical aspects using ControlNet.

**Topics Covered:**
- Extracting control signals (melody, rhythm, dynamics)
- Loading style adapters (Jazz, Techno, etc.)
- Applying controls with different strengths
- Multi-modal conditioning

**Run it:**
```bash
npx tsx neural-engine/examples/03-controlnet.ts
```

---

### 04 - Audio Inpainting
**File**: `04-inpainting.ts`

Surgical audio editing through spectrogram inpainting.

**Topics Covered:**
- Removing unwanted sounds
- Regenerating sections of audio
- Batch inpainting (multiple regions)
- Outpainting for loop generation
- Loop point detection

**Run it:**
```bash
npx tsx neural-engine/examples/04-inpainting.ts
```

---

### 05 - CLAP Audio Conditioning
**File**: `05-clap.ts`

Reference-based generation using CLAP embeddings.

**Topics Covered:**
- Encoding audio to embeddings
- Encoding text to embeddings
- Computing audio-text similarity
- Blending embeddings with different weights
- Reference-based music generation

**Run it:**
```bash
npx tsx neural-engine/examples/05-clap.ts
```

---

## Example Workflows

### Workflow 1: Quick Iteration
For rapid prototyping and experimentation:

```typescript
import { generateMusic } from '../index';

// Use 'fast' preset for quick iteration
const stems = await generateMusic({
  text: "Your prompt here",
  bpm: 120,
  bars: 16,
  quality: 'fast', // 5x faster than 'balanced'
});
```

### Workflow 2: Production Quality
For final renders:

```typescript
import { generateMusic } from '../index';

// Use 'high' preset for maximum quality
const stems = await generateMusic({
  text: "Your prompt here",
  bpm: 120,
  bars: 64,
  quality: 'high', // Best quality, slower
});
```

### Workflow 3: Style Transfer
Copy the style of a reference track:

```typescript
import { CLAP, generateMusic } from '../index';

const clap = new CLAP();
await clap.initialize();

// Encode reference track
const referenceEmbed = await clap.encodeAudio(referenceAudio);

// Generate with reference
const stems = await generateMusic({
  text: "New melody but same vibe",
  audioReference: referenceEmbed,
  audioReferenceWeight: 0.7, // 70% reference, 30% text
  bpm: 128,
  bars: 32,
});
```

### Workflow 4: Stem Replacement
Replace a specific stem in existing music:

```typescript
import { SpectrogramInpainter } from '../index';

const inpainter = new SpectrogramInpainter();
await inpainter.initialize();

// Load existing mix
const existingMix = await loadAudio('existing-track.wav');

// Mask the drums (regenerate just the drum section)
const drumMask = {
  startTime: 0,
  endTime: 60, // 60 seconds
  freqMin: 20,   // Low frequencies
  freqMax: 500,  // Up to 500 Hz (drum range)
};

// Inpaint with new drums
const newMix = await inpainter.inpaint(existingMix, drumMask);
```

---

## Common Patterns

### Pattern: Progress Tracking

```typescript
import { ProgressTracker } from '../utils/helpers';

const tracker = new ProgressTracker();
tracker.addStage('planning', 100);
tracker.addStage('rendering', 100);

tracker.onProgress((progress, stage) => {
  console.log(`[${stage}] ${(progress * 100).toFixed(1)}%`);
});

// Use in generation
await planner.generate(prompt, (p) => tracker.update('planning', p * 100));
```

### Pattern: Time Estimation

```typescript
import { estimateGenerationTime, formatTime } from '../utils/helpers';

const estimate = estimateGenerationTime(32, 'draft', 'RTX3090');
console.log(`Estimated: ${formatTime(estimate.total)}`);
```

### Pattern: Audio Normalization

```typescript
import { normalizeAudio, calculatePeakDB } from '../utils/helpers';

// Normalize all stems before mixing
const normalizedStems = stems.map(stem => normalizeAudio(stem, 0.9));

// Check levels
normalizedStems.forEach((stem, i) => {
  const peakDB = calculatePeakDB(stem);
  console.log(`Stem ${i}: ${peakDB.toFixed(1)} dB`);
});
```

---

## Tips & Best Practices

### Performance Tips

1. **Use appropriate quality presets**
   - `'fast'` for iteration and experimentation
   - `'balanced'` for preview and testing
   - `'high'` for final production renders

2. **Batch operations when possible**
   ```typescript
   // Process all stems in parallel
   const results = await Promise.all(
     latents.map(latent => vocoder.decode(latent))
   );
   ```

3. **Reuse initialized components**
   ```typescript
   // Don't initialize for every generation
   const renderer = new AcousticRenderer();
   await renderer.initialize(); // Once
   
   // Use multiple times
   for (const prompt of prompts) {
     await renderer.render(prompt);
   }
   ```

### Quality Tips

1. **Use higher guidance scale for better text adherence**
   ```typescript
   const renderer = new AcousticRenderer({ guidanceScale: 4.0 });
   ```

2. **Apply normalization before export**
   ```typescript
   const normalized = stems.map(s => normalizeAudio(s, 0.95));
   ```

3. **Use seamless loops for continuous playback**
   ```typescript
   const extended = await inpainter.outpaint(loop, 24, true);
   ```

---

## Next Steps

After exploring these examples:

1. **Read the full API documentation**: [neural-engine/README.md](../README.md)
2. **Check the test suite**: [neural-engine/test.ts](../test.ts)
3. **Try the interactive demo**: `npm run demo`
4. **Integrate into your application**: Import components as needed

---

## Troubleshooting

**Issue**: Examples fail with "Module not found"
- **Solution**: Run `npm install` from the project root

**Issue**: TypeScript errors
- **Solution**: Ensure you have TypeScript 5.8+ installed: `npm install -D typescript@~5.8.2`

**Issue**: Examples run slowly
- **Solution**: Examples use stub implementations. Real performance will vary with actual neural models.

---

## Contributing

Found a bug or want to add an example?

1. Create an issue: https://github.com/GizzZmo/NAW/issues
2. Submit a PR with your example
3. Follow the existing example structure
4. Add documentation to this README

---

**Happy generating! 🎵**
