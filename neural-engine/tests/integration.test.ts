/**
 * Integration Tests for Phase 3-4 Architectures
 * 
 * Tests the stub implementations of advanced features to ensure
 * all architectures are properly integrated.
 */

import {
  // ControlNet exports
  ControlNet,
  ControlType,
  DEFAULT_CONTROLNET_CONFIG,
  loadStyleAdapter,
  STYLE_ADAPTERS,
} from '../control/ControlNet';

import {
  // CLAP exports
  CLAP,
  DEFAULT_CLAP_CONFIG,
  MUSIC_STYLE_TAGS,
} from '../conditioning/CLAP';

import {
  // Inpainting exports
  SpectrogramInpainter,
  InpaintingMethod,
  DEFAULT_INPAINTING_CONFIG,
  quickInpaint,
} from '../inpainting/SpectrogramInpainter';

import {
  // Vocoder exports
  Vocoder,
  VocoderType,
  DEFAULT_VOCODER_CONFIG,
  decodeMix,
} from '../vocoder/Vocoder';

import {
  // Neural engine status
  getNeuralEngineStatus,
  NEURAL_ENGINE_VERSION,
  generateMusic,
} from '../index';

/**
 * Simple test runner
 */
class TestRunner {
  private passed = 0;
  private failed = 0;

  async test(name: string, fn: () => Promise<void> | void): Promise<void> {
    try {
      await fn();
      console.log(`✓ ${name}`);
      this.passed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      this.failed++;
    }
  }

  report(): void {
    console.log(`\nTest Results: ${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

/**
 * Run all integration tests
 */
async function runTests() {
  const runner = new TestRunner();

  console.log('='.repeat(60));
  console.log('Integration Tests: Phase 3-4 Architectures');
  console.log('='.repeat(60));

  // ControlNet Tests
  console.log('\nControlNet Tests:');
  
  await runner.test('ControlNet: Initialize', async () => {
    const controlNet = new ControlNet();
    await controlNet.initialize();
  });

  await runner.test('ControlNet: Extract melody signal', async () => {
    const controlNet = new ControlNet({ controlType: ControlType.MELODY });
    await controlNet.initialize();
    
    const audio = new Float32Array(44100); // 1 second
    const signal = await controlNet.extractControlSignal(audio);
    
    if (signal.type !== ControlType.MELODY) {
      throw new Error('Signal type mismatch');
    }
    if (signal.data.length === 0) {
      throw new Error('No signal data');
    }
  });

  await runner.test('ControlNet: Apply control to latent', async () => {
    const controlNet = new ControlNet();
    await controlNet.initialize();
    
    const latent = [[1, 2, 3], [4, 5, 6]];
    const signal = {
      type: ControlType.RHYTHM,
      data: new Float32Array(10),
      sampleRate: 50,
      duration: 0.2,
    };
    
    const result = await controlNet.applyControl(latent, signal);
    if (!result || result.length === 0) {
      throw new Error('No result from applyControl');
    }
  });

  await runner.test('ControlNet: Set conditioning strength', async () => {
    const controlNet = new ControlNet();
    controlNet.setConditioningStrength(0.5);
    
    const config = controlNet.getConfig();
    if (config.conditioningStrength !== 0.5) {
      throw new Error('Conditioning strength not set');
    }
  });

  await runner.test('Style Adapters: Load adapter', async () => {
    const adapter = await loadStyleAdapter('jazz');
    if (!adapter) {
      throw new Error('Failed to load adapter');
    }
    if (adapter.name !== 'jazz') {
      throw new Error('Wrong adapter loaded');
    }
  });

  // CLAP Tests
  console.log('\nCLAP Tests:');

  await runner.test('CLAP: Initialize', async () => {
    const clap = new CLAP();
    await clap.initialize();
  });

  await runner.test('CLAP: Encode audio', async () => {
    const clap = new CLAP();
    await clap.initialize();
    
    const audio = new Float32Array(48000); // 1 second at 48kHz
    const embedding = await clap.encodeAudio(audio);
    
    if (embedding.embedding.length !== DEFAULT_CLAP_CONFIG.embedDim) {
      throw new Error('Wrong embedding dimension');
    }
  });

  await runner.test('CLAP: Encode text', async () => {
    const clap = new CLAP();
    await clap.initialize();
    
    const embedding = await clap.encodeText('energetic techno');
    
    if (embedding.embedding.length !== DEFAULT_CLAP_CONFIG.embedDim) {
      throw new Error('Wrong embedding dimension');
    }
    if (embedding.text !== 'energetic techno') {
      throw new Error('Text mismatch');
    }
  });

  await runner.test('CLAP: Compute similarity', async () => {
    const clap = new CLAP();
    await clap.initialize();
    
    const audio = new Float32Array(48000);
    const audioEmbed = await clap.encodeAudio(audio);
    const textEmbed = await clap.encodeText('test prompt');
    
    const similarity = clap.computeSimilarity(audioEmbed, textEmbed);
    
    if (similarity < 0 || similarity > 1) {
      throw new Error('Similarity out of range');
    }
  });

  await runner.test('CLAP: Blend embeddings', async () => {
    const clap = new CLAP();
    await clap.initialize();
    
    const audio = new Float32Array(48000);
    const audioEmbed = await clap.encodeAudio(audio);
    const textEmbed = await clap.encodeText('test prompt');
    
    const blended = clap.blendEmbeddings(audioEmbed, textEmbed, 0.7);
    
    if (blended.length !== DEFAULT_CLAP_CONFIG.embedDim) {
      throw new Error('Wrong blended embedding dimension');
    }
  });

  await runner.test('CLAP: Find similar texts', async () => {
    const clap = new CLAP();
    await clap.initialize();
    
    const audio = new Float32Array(48000);
    const audioEmbed = await clap.encodeAudio(audio);
    
    const results = await clap.findSimilarTexts(
      audioEmbed,
      ['jazz', 'techno', 'classical'],
      2
    );
    
    if (results.length !== 2) {
      throw new Error('Wrong number of results');
    }
    if (results[0].similarity < results[1].similarity) {
      throw new Error('Results not sorted by similarity');
    }
  });

  // Inpainting Tests
  console.log('\nInpainting Tests:');

  await runner.test('Inpainting: Initialize', async () => {
    const inpainter = new SpectrogramInpainter();
    await inpainter.initialize();
  });

  await runner.test('Inpainting: Basic inpaint', async () => {
    const inpainter = new SpectrogramInpainter();
    await inpainter.initialize();
    
    const audio = new Float32Array(44100 * 5); // 5 seconds
    const mask = {
      startTime: 1.0,
      endTime: 2.0,
      freqMin: null,
      freqMax: null,
      strength: 1.0,
    };
    
    const result = await inpainter.inpaint(audio, mask);
    
    if (!result.audio) {
      throw new Error('No audio in result');
    }
    if (result.processingTime <= 0) {
      throw new Error('Invalid processing time');
    }
  });

  await runner.test('Inpainting: Quick inpaint helper', async () => {
    const audio = new Float32Array(44100 * 3);
    const result = await quickInpaint(audio, 0.5, 1.5);
    
    if (result.length !== audio.length) {
      throw new Error('Output length mismatch');
    }
  });

  await runner.test('Inpainting: Outpaint', async () => {
    const inpainter = new SpectrogramInpainter();
    await inpainter.initialize();
    
    const audio = new Float32Array(44100 * 2); // 2 seconds
    const extended = await inpainter.outpaint(audio, 3.0, true);
    
    if (extended.length <= audio.length) {
      throw new Error('Audio not extended');
    }
  });

  await runner.test('Inpainting: Batch inpaint', async () => {
    const inpainter = new SpectrogramInpainter();
    await inpainter.initialize();
    
    const audio = new Float32Array(44100 * 5);
    const masks = [
      { startTime: 1.0, endTime: 1.5, freqMin: null, freqMax: null, strength: 1.0 },
      { startTime: 3.0, endTime: 3.5, freqMin: null, freqMax: null, strength: 1.0 },
    ];
    
    const result = await inpainter.batchInpaint(audio, masks);
    
    if (!result.audio) {
      throw new Error('No audio in batch result');
    }
  });

  // Neural Engine Status Tests
  console.log('\nNeural Engine Status Tests:');

  await runner.test('Neural Engine: Version check', async () => {
    if (!NEURAL_ENGINE_VERSION || NEURAL_ENGINE_VERSION.length === 0) {
      throw new Error('No version defined');
    }
    console.log(`  Version: ${NEURAL_ENGINE_VERSION}`);
  });

  await runner.test('Neural Engine: Status check', async () => {
    const status = getNeuralEngineStatus();
    
    if (!status.components) {
      throw new Error('No components in status');
    }
    
    // Check all new components are present
    if (status.components.controlNet === undefined) {
      throw new Error('ControlNet status missing');
    }
    if (status.components.clap === undefined) {
      throw new Error('CLAP status missing');
    }
    if (status.components.inpainting === undefined) {
      throw new Error('Inpainting status missing');
    }
    if (status.components.vocoder === undefined) {
      throw new Error('Vocoder status missing');
    }
  });

  // Vocoder Tests
  console.log('\nVocoder Tests:');

  await runner.test('Vocoder: Initialize', async () => {
    const vocoder = new Vocoder();
    await vocoder.initialize();
    
    if (!vocoder.isInitialized()) {
      throw new Error('Vocoder not initialized');
    }
  });

  await runner.test('Vocoder: Decode latent', async () => {
    const vocoder = new Vocoder({ type: VocoderType.VOCOS });
    await vocoder.initialize();
    
    // Create a dummy latent
    const latent = {
      codes: Array(16).fill(0).map(() => Array(100).fill(0)),
      timeSteps: 100,
      config: {
        sampleRate: 44100,
        latentRate: 24000,
        numCodebooks: 16,
        codebookSize: 1024,
        semanticCodebooks: 2,
      },
    };
    
    const result = await vocoder.decode(latent);
    
    if (result.audio.length === 0) {
      throw new Error('No audio in result');
    }
    if (result.vocoderType !== VocoderType.VOCOS) {
      throw new Error('Wrong vocoder type');
    }
    if (result.processingTime <= 0) {
      throw new Error('Invalid processing time');
    }
  });

  await runner.test('Vocoder: Switch vocoder type', async () => {
    const vocoder = new Vocoder({ type: VocoderType.VOCOS });
    await vocoder.initialize();
    
    await vocoder.switchVocoder(VocoderType.DISCODER);
    
    const config = vocoder.getConfig();
    if (config.type !== VocoderType.DISCODER) {
      throw new Error('Vocoder type not switched');
    }
  });

  await runner.test('Vocoder: Decode and mix stems', async () => {
    // Create dummy latents for 4 stems
    const latents = Array(4).fill(0).map(() => ({
      codes: Array(16).fill(0).map(() => Array(50).fill(0)),
      timeSteps: 50,
      config: {
        sampleRate: 44100,
        latentRate: 24000,
        numCodebooks: 16,
        codebookSize: 1024,
        semanticCodebooks: 2,
      },
    }));
    
    const mixed = await decodeMix(latents, ['DRUMS', 'BASS', 'VOCALS', 'OTHER']);
    
    if (mixed.length === 0) {
      throw new Error('No mixed audio');
    }
  });

  // Full Pipeline Test
  console.log('\nFull Pipeline Tests:');

  await runner.test('Pipeline: generateMusic', async () => {
    const stems = await generateMusic({
      text: 'Test music generation',
      bpm: 120,
      bars: 2,
      quality: 'fast',
    });
    
    if (stems.size !== 4) {
      throw new Error('Expected 4 stems');
    }
    if (!stems.has('DRUMS') || !stems.has('BASS') || !stems.has('VOCALS') || !stems.has('OTHER')) {
      throw new Error('Missing stems');
    }
    
    // Check each stem has audio
    for (const [name, audio] of stems.entries()) {
      if (audio.length === 0) {
        throw new Error(`${name} has no audio`);
      }
    }
  });

  // Configuration Tests
  console.log('\nConfiguration Tests:');

  await runner.test('Constants: Style adapters available', async () => {
    if (STYLE_ADAPTERS.length === 0) {
      throw new Error('No style adapters defined');
    }
    console.log(`  Style Adapters: ${STYLE_ADAPTERS.map(a => a.name).join(', ')}`);
  });

  await runner.test('Constants: Music style tags available', async () => {
    if (MUSIC_STYLE_TAGS.length === 0) {
      throw new Error('No music style tags defined');
    }
    console.log(`  Style Tags: ${MUSIC_STYLE_TAGS.length} tags`);
  });

  runner.report();
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
