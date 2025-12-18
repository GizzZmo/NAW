/**
 * Example: ControlNet for Fine-Grained Control
 * 
 * This example demonstrates using ControlNet to control
 * specific musical aspects during generation.
 */

import {
  ControlNet,
  ControlType,
  AcousticRenderer,
  Vocoder,
  loadStyleAdapter,
} from '../index';

async function controlNetExample() {
  console.log('=== ControlNet Fine-Grained Control Example ===\n');

  // Initialize components
  const controlNet = new ControlNet();
  const renderer = new AcousticRenderer();
  const vocoder = new Vocoder();

  console.log('Initializing components...');
  await Promise.all([
    controlNet.initialize(),
    renderer.initialize(),
    vocoder.initialize(),
  ]);
  console.log('Initialized!\n');

  // Simulate reference audio (in real implementation, load from file)
  const referenceAudio = new Float32Array(44100 * 10); // 10 seconds
  
  // Extract different control signals
  console.log('Extracting control signals...');
  
  const melodySignal = await controlNet.extractControlSignal(
    referenceAudio,
    ControlType.MELODY
  );
  console.log(`  Melody: ${melodySignal.data.length} control points`);

  const rhythmSignal = await controlNet.extractControlSignal(
    referenceAudio,
    ControlType.RHYTHM
  );
  console.log(`  Rhythm: ${rhythmSignal.data.length} control points`);

  const dynamicsSignal = await controlNet.extractControlSignal(
    referenceAudio,
    ControlType.DYNAMICS
  );
  console.log(`  Dynamics: ${dynamicsSignal.data.length} control points\n`);

  // Load style adapter
  console.log('Loading style adapter...');
  const jazzAdapter = await loadStyleAdapter('jazz');
  console.log(`Loaded adapter: ${jazzAdapter.name} (${jazzAdapter.size} params)\n`);

  // Generate with multiple controls
  console.log('Generating with control signals...');
  
  // Create a simple latent for demonstration
  const dummyLatent = Array.from({ length: 4 }, () => 
    Array.from({ length: 1000 }, () => Math.floor(Math.random() * 1024))
  );

  // Apply melody control
  const controlledLatent = await controlNet.applyControl(
    dummyLatent,
    melodySignal,
    0.8 // 80% control strength
  );

  console.log('Control applied successfully!\n');

  // Set conditioning strength for subtle vs strong control
  console.log('Experimenting with different control strengths:');
  
  for (const strength of [0.3, 0.6, 0.9]) {
    controlNet.setConditioningStrength(strength);
    console.log(`  Strength ${strength}: Control influence ${(strength * 100).toFixed(0)}%`);
  }

  console.log('\n✓ Example complete!');
  console.log('In a real application, you would:');
  console.log('  1. Load actual reference audio');
  console.log('  2. Extract control signals from it');
  console.log('  3. Generate new audio matching those controls');
  console.log('  4. Fine-tune with style adapters');
}

// Run the example
controlNetExample().catch(console.error);
