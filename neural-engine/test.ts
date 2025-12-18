/**
 * Neural Engine Tests
 * 
 * Simple tests for Phase 2 neural engine components.
 * These tests validate the stub implementations and architecture.
 */

import {
  DACCodec,
  SemanticPlanner,
  AcousticRenderer,
  getNeuralEngineStatus,
  isNeuralEngineReady,
  NEURAL_ENGINE_VERSION,
  type DACLatent,
  type SemanticSkeleton,
  Vocoder,
  VocoderType,
  generateMusic,
} from './index';

// Test counter
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
const SIGNAL_THRESHOLD = 1e-6;

/**
 * Simple assertion helper
 */
function assert(condition: boolean, message: string): void {
  testsRun++;
  if (condition) {
    testsPassed++;
    console.log(`✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`✗ ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Test runner
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Neural Engine Tests');
  console.log('='.repeat(60));
  console.log();

  try {
    // Test 1: Version and Status
    console.log('Test Suite: Version and Status');
    console.log('-'.repeat(60));
    
    assert(
      typeof NEURAL_ENGINE_VERSION === 'string',
      'NEURAL_ENGINE_VERSION is defined'
    );
    
    assert(
      isNeuralEngineReady() === true,
      'Neural engine reports ready'
    );
    
    const status = getNeuralEngineStatus();
    assert(
      status.version === NEURAL_ENGINE_VERSION,
      'Status version matches'
    );
    assert(
      status.ready === true,
      'Status ready is true'
    );
    assert(
      status.components.codec === true,
      'Codec component ready'
    );
    assert(
      status.components.planner === true,
      'Planner component ready'
    );
    assert(
      status.components.renderer === true,
      'Renderer component ready'
    );
    assert(
      status.components.vocoder === true,
      'Vocoder component ready'
    );
    console.log();

    // Test 2: DAC Codec
    console.log('Test Suite: DAC Codec');
    console.log('-'.repeat(60));
    
    const codec = new DACCodec();
    assert(
      codec !== null,
      'DAC codec can be instantiated'
    );
    
    await codec.initialize();
    assert(
      true,
      'DAC codec initializes without error'
    );
    
    const config = codec.getConfig();
    assert(
      config.sampleRate === 44100,
      'Sample rate is 44.1kHz'
    );
    assert(
      config.numCodebooks === 16,
      'Has 16 codebooks'
    );
    assert(
      config.semanticCodebooks === 2,
      'Has 2 semantic codebooks'
    );
    
    // Test encoding
    const audioData = new Float32Array(44100); // 1 second
    const latent = await codec.encode(audioData);
    assert(
      latent.codes.length === 16,
      'Encoded latent has 16 codebooks'
    );
    assert(
      latent.timeSteps > 0,
      'Encoded latent has time steps'
    );
    
    // Test semantic/acoustic split
    const semantic = codec.extractSemanticTokens(latent);
    assert(
      semantic.length === 2,
      'Extracted 2 semantic codebooks'
    );
    
    const acoustic = codec.extractAcousticTokens(latent);
    assert(
      acoustic.length === 14,
      'Extracted 14 acoustic codebooks'
    );
    
    // Test decoding
    const decoded = await codec.decode(latent);
    assert(
      decoded.length > 0,
      'Decoded audio has samples'
    );
    const decodedEnergy = decoded.reduce((acc, v) => acc + Math.abs(v), 0);
    assert(
      decodedEnergy > 0,
      'Decoded audio contains signal'
    );

    const latentRepeat = await codec.encode(audioData);
    assert(
      latent.codes[0][0] === latentRepeat.codes[0][0],
      'Encoding is deterministic for identical input'
    );
    console.log();

    // Test 3: Semantic Planner
    console.log('Test Suite: Semantic Planner');
    console.log('-'.repeat(60));
    
    const planner = new SemanticPlanner();
    assert(
      planner !== null,
      'Semantic planner can be instantiated'
    );
    
    await planner.initialize();
    assert(
      true,
      'Semantic planner initializes without error'
    );
    
    const plannerConfig = planner.getConfig();
    assert(
      plannerConfig.modelSize === '500M',
      'Model size is 500M'
    );
    assert(
      plannerConfig.numStems === 4,
      'Generates 4 stems'
    );
    
    // Test generation
    const skeleton = await planner.generate({
      text: 'Test prompt',
      bpm: 120,
      bars: 4,
    });
    assert(
      skeleton.stemNames.length === 4,
      'Generated 4 stems'
    );
    assert(
      skeleton.tokens.length === 4,
      'Has tokens for 4 stems'
    );
    assert(
      skeleton.tokens[0].length === 2,
      'Has 2 semantic codebooks per stem'
    );
    assert(
      skeleton.timeSteps > 0,
      'Has time steps'
    );
    const skeletonRepeat = await planner.generate({
      text: 'Test prompt',
      bpm: 120,
      bars: 4,
    });
    assert(
      skeleton.tokens[0][0][0] === skeletonRepeat.tokens[0][0][0],
      'Semantic planner output is deterministic'
    );
    console.log();

    // Test 4: Acoustic Renderer
    console.log('Test Suite: Acoustic Renderer');
    console.log('-'.repeat(60));
    
    const renderer = new AcousticRenderer();
    assert(
      renderer !== null,
      'Acoustic renderer can be instantiated'
    );
    
    await renderer.initialize();
    assert(
      true,
      'Acoustic renderer initializes without error'
    );
    
    const rendererConfig = renderer.getConfig();
    assert(
      rendererConfig.modelSize === '1B',
      'Model size is 1B'
    );
    assert(
      rendererConfig.numSteps === 10,
      'Uses 10 diffusion steps'
    );
    
    // Test rendering
    const latents = await renderer.render({
      text: 'Test prompt',
      semanticTokens: skeleton.tokens,
    });
    assert(
      latents.length === 4,
      'Rendered 4 latents'
    );
    assert(
      latents[0].codes.length === 16,
      'Latent has 16 codebooks (semantic + acoustic)'
    );
    assert(
      latents[0].codes[0][0] === skeleton.tokens[0][0][0],
      'Semantic tokens are preserved in rendered latents'
    );
    const latentsRepeat = await renderer.render({
      text: 'Test prompt',
      semanticTokens: skeleton.tokens,
    });
    assert(
      latentsRepeat[0].codes[2][0] === latents[0].codes[2][0],
      'Acoustic rendering is deterministic'
    );
    
    // Test quality settings
    renderer.setQuality('fast');
    assert(
      renderer.getConfig().numSteps === 5,
      'Fast quality uses 5 steps'
    );
    
    renderer.setQuality('high');
    assert(
      renderer.getConfig().numSteps === 20,
      'High quality uses 20 steps'
    );
    console.log();

    // Test 5: End-to-End Pipeline
    console.log('Test Suite: End-to-End Pipeline');
    console.log('-'.repeat(60));
    
    const pipelineCodec = new DACCodec();
    const pipelinePlanner = new SemanticPlanner({ numStems: 4 });
    const pipelineRenderer = new AcousticRenderer();
    
    await pipelineCodec.initialize();
    await pipelinePlanner.initialize();
    await pipelineRenderer.initialize();
    
    // Generate skeleton
    const pipelineSkeleton = await pipelinePlanner.generate({
      text: 'House track',
      bpm: 128,
      bars: 8,
    });
    
    // Render acoustic details
    const pipelineLatents = await pipelineRenderer.render({
      text: 'House track',
      semanticTokens: pipelineSkeleton.tokens,
    });
    
    // Decode to audio
    const stems = new Map<string, Float32Array>();
    for (let i = 0; i < pipelineLatents.length; i++) {
      const audio = await pipelineCodec.decode(pipelineLatents[i]);
      stems.set(pipelineSkeleton.stemNames[i], audio);
    }
    
    assert(
      stems.size === 4,
      'Pipeline generated 4 audio stems'
    );
    assert(
      stems.has('DRUMS') && stems.has('BASS') && stems.has('VOCALS') && stems.has('OTHER'),
      'All expected stems present'
    );
    for (const [stemName, audio] of stems.entries()) {
      const energy = audio.reduce((acc, v) => acc + Math.abs(v), 0);
      assert(
        energy > 0,
        `${stemName} stem carries audio energy`
      );
    }
    console.log();

    // Test 6: Vocoder
    console.log('Test Suite: Vocoder');
    console.log('-'.repeat(60));
    
    const vocoder = new Vocoder({ type: VocoderType.VOCOS });
    assert(
      vocoder !== null,
      'Vocoder can be instantiated'
    );
    
    await vocoder.initialize();
    assert(
      vocoder.isInitialized(),
      'Vocoder initializes without error'
    );
    
    const vocoderConfig = vocoder.getConfig();
    assert(
      vocoderConfig.type === VocoderType.VOCOS,
      'Vocoder type is VOCOS'
    );
    assert(
      vocoderConfig.sampleRate === 44100,
      'Sample rate is 44.1kHz'
    );
    assert(
      vocoderConfig.channels === 2,
      'Stereo output'
    );
    
    // Test decoding
    const testLatent: DACLatent = {
      codes: pipelineLatents[0].codes,
      timeSteps: pipelineLatents[0].timeSteps,
      config: pipelineLatents[0].config,
    };
    
    const vocoderResult = await vocoder.decode(testLatent);
    assert(
      vocoderResult.audio.length > 0,
      'Vocoder decoded audio'
    );
    assert(
      vocoderResult.vocoderType === VocoderType.VOCOS,
      'Result has correct vocoder type'
    );
    assert(
      vocoderResult.processingTime > 0,
      'Processing time recorded'
    );
    
    // Test vocoder switching
    await vocoder.switchVocoder(VocoderType.DISCODER);
    assert(
      vocoder.getConfig().type === VocoderType.DISCODER,
      'Switched to DisCoder'
    );
    console.log();

    // Test 7: Full Pipeline with generateMusic
    console.log('Test Suite: Full Pipeline (generateMusic)');
    console.log('-'.repeat(60));
    
    const generatedStems = await generateMusic({
      text: 'Energetic techno track',
      bpm: 140,
      bars: 4,
      quality: 'fast',
    });
    
    assert(
      generatedStems.size === 4,
      'generateMusic returned 4 stems'
    );
    assert(
      generatedStems.has('DRUMS'),
      'Has DRUMS stem'
    );
    assert(
      generatedStems.has('BASS'),
      'Has BASS stem'
    );
    assert(
      generatedStems.has('VOCALS'),
      'Has VOCALS stem'
    );
    assert(
      generatedStems.has('OTHER'),
      'Has OTHER stem'
    );
    
    // Check that each stem has audio data
    for (const [name, audio] of generatedStems.entries()) {
      assert(
        audio.length > 0,
        `${name} stem has audio data`
      );
      const signal = audio.some(sample => Math.abs(sample) > SIGNAL_THRESHOLD);
      assert(
        signal,
        `${name} stem has non-zero signal`
      );
    }
    console.log();

  } catch (error) {
    console.error('Test failed with error:', error);
  }

  // Summary
  console.log('='.repeat(60));
  console.log('Test Results');
  console.log('='.repeat(60));
  console.log(`Total tests: ${testsRun}`);
  console.log(`Passed: ${testsPassed} ✓`);
  console.log(`Failed: ${testsFailed} ✗`);
  console.log();

  if (testsFailed > 0) {
    console.error('Some tests failed!');
    process.exit(1);
  } else {
    console.log('All tests passed! ✓');
    process.exit(0);
  }
}

// Run tests
runTests();
