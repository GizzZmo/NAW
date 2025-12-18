/**
 * Example: Audio Inpainting
 * 
 * This example demonstrates surgical audio editing through
 * spectrogram inpainting.
 */

import {
  SpectrogramInpainter,
  InpaintingMethod,
  type InpaintingMask,
} from '../index';
import { samplesToSeconds, formatTime } from '../utils/helpers';

async function inpaintingExample() {
  console.log('=== Audio Inpainting Example ===\n');

  // Initialize inpainter
  const inpainter = new SpectrogramInpainter({
    method: InpaintingMethod.DISCRETE_DIFFUSION,
    blendingMethod: 'smooth',
    fadeLength: 0.1, // 100ms fade
  });

  console.log('Initializing inpainter...');
  await inpainter.initialize();
  console.log('Initialized!\n');

  // Simulate audio (in real implementation, load from file)
  const sampleRate = 44100;
  const duration = 10; // 10 seconds
  const audio = new Float32Array(sampleRate * duration);
  
  console.log(`Audio: ${samplesToSeconds(audio.length, sampleRate).toFixed(1)}s (${audio.length} samples)\n`);

  // Example 1: Remove unwanted sound (e.g., snare)
  console.log('Example 1: Removing unwanted sound...');
  
  const snareMask: InpaintingMask = {
    startTime: 2.0,     // Start at 2 seconds
    endTime: 2.1,       // End at 2.1 seconds (100ms)
    freqMin: 200,       // 200 Hz
    freqMax: 8000,      // 8000 Hz (snare frequency range)
  };

  const startTime1 = Date.now();
  const result1 = await inpainter.inpaint(audio, snareMask);
  const time1 = (Date.now() - startTime1) / 1000;

  console.log(`  Inpainted ${result1.inpaintedSamples} samples in ${formatTime(time1)}`);
  console.log(`  Quality score: ${result1.quality?.toFixed(2)}\n`);

  // Example 2: Regenerate entire section
  console.log('Example 2: Regenerating section...');
  
  const sectionMask: InpaintingMask = {
    startTime: 5.0,     // Start at 5 seconds
    endTime: 7.0,       // End at 7 seconds (2 second gap)
    freqMin: 0,         // Full frequency range
    freqMax: 22050,     // Nyquist frequency
  };

  const startTime2 = Date.now();
  const result2 = await inpainter.inpaint(audio, sectionMask);
  const time2 = (Date.now() - startTime2) / 1000;

  console.log(`  Inpainted ${result2.inpaintedSamples} samples in ${formatTime(time2)}`);
  console.log(`  Quality score: ${result2.quality?.toFixed(2)}\n`);

  // Example 3: Batch inpainting (multiple regions)
  console.log('Example 3: Batch inpainting (remove multiple elements)...');
  
  const batchMasks: InpaintingMask[] = [
    { startTime: 1.0, endTime: 1.1, freqMin: 200, freqMax: 8000 },   // Snare 1
    { startTime: 3.0, endTime: 3.1, freqMin: 200, freqMax: 8000 },   // Snare 2
    { startTime: 5.0, endTime: 5.1, freqMin: 200, freqMax: 8000 },   // Snare 3
  ];

  const startTime3 = Date.now();
  const result3 = await inpainter.batchInpaint(audio, batchMasks);
  const time3 = (Date.now() - startTime3) / 1000;

  console.log(`  Batch inpainted ${batchMasks.length} regions in ${formatTime(time3)}`);
  console.log(`  Total samples inpainted: ${result3.inpaintedSamples}\n`);

  // Example 4: Outpainting for loop generation
  console.log('Example 4: Extending audio (outpainting)...');
  
  const shortLoop = new Float32Array(sampleRate * 2); // 2-second loop
  
  const startTime4 = Date.now();
  const extended = await inpainter.outpaint(
    shortLoop,
    6, // Extend by 6 seconds
    true // Seamless loop
  );
  const time4 = (Date.now() - startTime4) / 1000;

  console.log(`  Extended from ${samplesToSeconds(shortLoop.length).toFixed(1)}s to ${samplesToSeconds(extended.length).toFixed(1)}s`);
  console.log(`  Processing time: ${formatTime(time4)}\n`);

  // Example 5: Loop point detection
  console.log('Example 5: Detecting loop points...');
  
  const loopPoints = await inpainter.detectLoopPoints(audio);
  
  console.log(`  Found ${loopPoints.length} potential loop points:`);
  loopPoints.slice(0, 3).forEach((point, i) => {
    console.log(`    ${i + 1}. ${point.start.toFixed(2)}s → ${point.end.toFixed(2)}s (confidence: ${point.confidence.toFixed(2)})`);
  });

  console.log('\n✓ Example complete!');
  console.log('Inpainting use cases:');
  console.log('  • Remove unwanted sounds (clicks, pops, noise)');
  console.log('  • Replace instruments or vocal sections');
  console.log('  • Extend short loops to longer arrangements');
  console.log('  • Create seamless loop points');
}

// Run the example
inpaintingExample().catch(console.error);
