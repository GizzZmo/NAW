/**
 * Example: Basic Music Generation
 * 
 * This example demonstrates the simplest way to generate music
 * using the neural engine's high-level API.
 */

import { generateMusic } from '../index';
import { formatTime, estimateGenerationTime } from '../utils/helpers';

async function basicGeneration() {
  console.log('=== Basic Music Generation Example ===\n');

  // Estimate generation time
  const estimate = estimateGenerationTime(32, 'draft', 'RTX3090');
  console.log('Estimated generation time:');
  console.log(`  Semantic Planning: ${formatTime(estimate.semantic)}`);
  console.log(`  Acoustic Rendering: ${formatTime(estimate.acoustic)}`);
  console.log(`  Vocoding: ${formatTime(estimate.vocoding)}`);
  console.log(`  Total: ${formatTime(estimate.total)}\n`);

  // Generate music
  console.log('Generating music...');
  const startTime = Date.now();

  const stems = await generateMusic({
    text: "Uplifting house track with energetic drums and warm bass",
    bpm: 128,
    bars: 32,
    quality: 'balanced',
  });

  const actualTime = (Date.now() - startTime) / 1000;
  console.log(`\nGeneration complete in ${formatTime(actualTime)}`);
  console.log(`Generated ${stems.size} stems`);
  
  // In a real implementation, you would save or play the stems here
  console.log('\nStems:');
  stems.forEach((stem, name) => {
    console.log(`  ${name}: ${stem.length} samples`);
  });
}

// Run the example
basicGeneration().catch(console.error);
