/**
 * Example: Advanced Pipeline Control
 * 
 * This example demonstrates fine-grained control over the
 * three-stage generation pipeline.
 */

import {
  DACCodec,
  SemanticPlanner,
  AcousticRenderer,
  Vocoder,
  VocoderType,
} from '../index';
import { ProgressTracker, formatTime } from '../utils/helpers';

async function advancedPipeline() {
  console.log('=== Advanced Pipeline Control Example ===\n');

  // Create components with custom configuration
  const codec = new DACCodec({
    sampleRate: 44100,
    numCodebooks: 16,
  });

  const planner = new SemanticPlanner({
    modelSize: '500M',
    temperature: 0.8,
    topK: 50,
  });

  const renderer = new AcousticRenderer({
    modelSize: '1B',
    numSteps: 25,
    guidanceScale: 3.5,
  });

  const vocoder = new Vocoder({
    type: VocoderType.DISCODER,
    useGPU: true,
  });

  // Initialize with progress tracking
  console.log('Initializing components...');
  const initStart = Date.now();
  await Promise.all([
    codec.initialize(),
    planner.initialize(),
    renderer.initialize(),
    vocoder.initialize(),
  ]);
  console.log(`Initialized in ${((Date.now() - initStart) / 1000).toFixed(2)}s\n`);

  // Set up progress tracking
  const tracker = new ProgressTracker();
  tracker.addStage('planning', 100);
  tracker.addStage('rendering', 100);
  tracker.onProgress((progress, stage) => {
    console.log(`[${stage}] ${(progress * 100).toFixed(1)}% complete`);
  });

  // Stage 1: Semantic Planning
  console.log('Stage 1: Semantic Planning...');
  const planningStart = Date.now();
  
  const skeleton = await planner.generate(
    {
      text: "Dark techno track with driving bass",
      bpm: 135,
      bars: 64,
    },
    (progress) => tracker.update('planning', progress * 100)
  );

  console.log(`Planning complete in ${formatTime((Date.now() - planningStart) / 1000)}`);
  console.log(`Generated ${skeleton.tokens.length} token streams\n`);

  // Stage 2: Acoustic Rendering
  console.log('Stage 2: Acoustic Rendering...');
  const renderingStart = Date.now();
  
  const latents = await renderer.render(
    {
      text: "Dark techno track with driving bass",
      semanticTokens: skeleton.tokens,
    },
    (progress) => tracker.update(
      'rendering',
      (progress.step / progress.totalSteps) * 100
    )
  );

  console.log(`Rendering complete in ${formatTime((Date.now() - renderingStart) / 1000)}`);
  console.log(`Generated ${latents.length} latent representations\n`);

  // Stage 3: Vocoding
  console.log('Stage 3: Vocoding...');
  const vocodingStart = Date.now();
  
  const audioResults = await Promise.all(
    latents.map(latent => vocoder.decode(latent))
  );

  console.log(`Vocoding complete in ${formatTime((Date.now() - vocodingStart) / 1000)}\n`);

  // Display results
  console.log('Results:');
  const stemNames = ['DRUMS', 'BASS', 'VOCALS', 'OTHER'];
  audioResults.forEach((result, i) => {
    console.log(`  ${stemNames[i]}:`);
    console.log(`    Samples: ${result.audio.length}`);
    console.log(`    RTF: ${result.rtf?.toFixed(1)}x realtime`);
    console.log(`    Processing: ${result.processingTime}ms`);
  });

  const totalTime = (Date.now() - initStart) / 1000;
  console.log(`\nTotal pipeline time: ${formatTime(totalTime)}`);
}

// Run the example
advancedPipeline().catch(console.error);
