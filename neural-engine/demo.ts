/**
 * Neural Engine Demo
 * 
 * Demonstrates the Phase 2 neural engine architecture in action.
 * This demo shows how the two-stage pipeline works with stub implementations.
 * 
 * Usage:
 * ```bash
 * npx tsx neural-engine/demo.ts
 * ```
 */

import {
  DACCodec,
  SemanticPlanner,
  AcousticRenderer,
  Vocoder,
  VocoderType,
  getNeuralEngineStatus,
  generateMusic,
  type SemanticPrompt,
  type RenderPrompt,
} from './index';

/**
 * Demo the neural engine pipeline
 */
async function runDemo() {
  console.log('='.repeat(60));
  console.log('Neural Engine Phase 2 Demo');
  console.log('='.repeat(60));
  console.log();

  // Check status
  const status = getNeuralEngineStatus();
  console.log('Engine Status:', JSON.stringify(status, null, 2));
  console.log();

  // Initialize components
  console.log('Initializing components...');
  const codec = new DACCodec();
  const planner = new SemanticPlanner();
  const renderer = new AcousticRenderer();

  await Promise.all([
    codec.initialize(),
    planner.initialize(),
    renderer.initialize(),
  ]);
  console.log('✓ All components initialized');
  console.log();

  // Stage 1: Semantic Planning
  console.log('Stage 1: Semantic Planning');
  console.log('-'.repeat(60));
  
  const prompt: SemanticPrompt = {
    text: 'Uplifting house track with energetic drums',
    bpm: 128,
    bars: 8, // Short demo
  };

  console.log(`Prompt: "${prompt.text}"`);
  console.log(`BPM: ${prompt.bpm}, Bars: ${prompt.bars}`);
  console.log();

  const skeleton = await planner.generate(prompt, (progress) => {
    if (progress % 20 === 0 || progress === 100) {
      console.log(`  Progress: ${progress.toFixed(0)}%`);
    }
  });

  console.log(`✓ Generated semantic skeleton:`);
  console.log(`  - Stems: ${skeleton.stemNames.join(', ')}`);
  console.log(`  - Time steps: ${skeleton.timeSteps}`);
  console.log(`  - Codebooks per stem: ${skeleton.tokens[0].length}`);
  console.log();

  // Stage 2: Acoustic Rendering
  console.log('Stage 2: Acoustic Rendering');
  console.log('-'.repeat(60));

  const renderPrompt: RenderPrompt = {
    text: prompt.text,
    semanticTokens: skeleton.tokens,
  };

  const latents = await renderer.render(renderPrompt, (progress) => {
    if (progress.step % 2 === 0 || progress.step === progress.totalSteps) {
      console.log(
        `  Stem ${progress.currentStem + 1}/${progress.totalStems}: ` +
        `Step ${progress.step}/${progress.totalSteps}`
      );
    }
  });

  console.log(`✓ Rendered acoustic details:`);
  console.log(`  - Latents generated: ${latents.length}`);
  console.log(`  - Codebooks per latent: ${latents[0].codes.length}`);
  console.log();

  // Stage 3: Vocoding (Decode to audio)
  console.log('Stage 3: Vocoding');
  console.log('-'.repeat(60));

  const vocoder = new Vocoder({ type: VocoderType.VOCOS });
  await vocoder.initialize();

  const audioStems = new Map<string, Float32Array>();
  for (let i = 0; i < latents.length; i++) {
    const result = await vocoder.decode(latents[i]);
    audioStems.set(skeleton.stemNames[i], result.audio);
    console.log(`  ✓ ${skeleton.stemNames[i]}: ${result.audio.length} samples (${result.rtf?.toFixed(1)}x realtime)`);
  }
  console.log();

  // Demonstrate full pipeline with generateMusic
  console.log('Full Pipeline Demo (generateMusic)');
  console.log('-'.repeat(60));
  console.log('Generating 4 bars of music with all stages integrated...');
  console.log();

  const stems = await generateMusic(
    {
      text: 'Energetic techno with driving bassline',
      bpm: 140,
      bars: 4,
      quality: 'balanced',
    },
    (stage, progress) => {
      if (progress % 25 === 0 || progress === 100) {
        console.log(`  ${stage}: ${progress.toFixed(0)}%`);
      }
    }
  );

  console.log();
  console.log('✓ Full pipeline complete:');
  for (const [name, audio] of stems.entries()) {
    console.log(`  - ${name}: ${audio.length} samples`);
  }
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('Demo Complete!');
  console.log('='.repeat(60));
  console.log();
  console.log('Summary:');
  console.log(`  - Generated ${skeleton.stemNames.length} stems (manual pipeline)`);
  console.log(`  - Total audio samples: ${Array.from(audioStems.values()).reduce((sum, arr) => sum + arr.length, 0)}`);
  console.log(`  - Generated ${stems.size} stems (full pipeline)`);
  console.log(`  - Pipeline stages: Semantic Planning → Acoustic Rendering → Vocoding`);
  console.log();
  console.log('Architecture Complete:');
  console.log('  ✓ DAC Codec');
  console.log('  ✓ Semantic Planner (Transformer)');
  console.log('  ✓ Acoustic Renderer (Flow Matching)');
  console.log('  ✓ Vocoder (Vocos/DisCoder/HiFiGAN)');
  console.log('  ✓ ControlNet Adapters');
  console.log('  ✓ CLAP Conditioning');
  console.log('  ✓ Spectrogram Inpainting');
  console.log();
  console.log('Note: This is a stub implementation for Phase 2 architecture validation.');
  console.log('Real neural models will be integrated in future updates.');
  console.log();
}

// Run the demo
runDemo().catch((error) => {
  console.error('Demo failed:', error);
  process.exit(1);
});
