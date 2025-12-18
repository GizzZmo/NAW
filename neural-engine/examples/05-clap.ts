/**
 * Example: CLAP Audio Conditioning
 * 
 * This example demonstrates reference-based generation using
 * CLAP (Contrastive Language-Audio Pretraining).
 */

import { CLAP, generateMusic } from '../index';

async function clapExample() {
  console.log('=== CLAP Audio Conditioning Example ===\n');

  // Initialize CLAP
  const clap = new CLAP({
    modelSize: 'large',
    embeddingDim: 512,
  });

  console.log('Initializing CLAP...');
  await clap.initialize();
  console.log('Initialized!\n');

  // Simulate reference audio (in real implementation, load from file)
  const referenceAudio = new Float32Array(44100 * 30); // 30 seconds
  
  // Example 1: Encode audio
  console.log('Example 1: Encoding audio reference...');
  const audioEmbed = await clap.encodeAudio(referenceAudio);
  console.log(`  Audio embedding: ${audioEmbed.embedding.length} dimensions`);
  console.log(`  Confidence: ${audioEmbed.confidence.toFixed(2)}\n`);

  // Example 2: Encode text
  console.log('Example 2: Encoding text prompts...');
  
  const textPrompts = [
    "Energetic electronic dance music",
    "Mellow lo-fi hip hop beats",
    "Aggressive metal guitar riffs",
    "Ambient atmospheric soundscape",
  ];

  const textEmbeddings = await Promise.all(
    textPrompts.map(text => clap.encodeText(text))
  );

  textPrompts.forEach((text, i) => {
    console.log(`  "${text}"`);
    console.log(`    Embedding: ${textEmbeddings[i].embedding.length} dimensions`);
  });
  console.log();

  // Example 3: Compute similarity between audio and text
  console.log('Example 3: Computing audio-text similarity...');
  
  const similarities = textPrompts.map((text, i) => ({
    text,
    similarity: clap.computeSimilarity(audioEmbed, textEmbeddings[i]),
  }));

  // Sort by similarity (descending)
  similarities.sort((a, b) => b.similarity - a.similarity);

  console.log('  Similarity scores:');
  similarities.forEach(({ text, similarity }) => {
    const percentage = (similarity * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(similarity * 20));
    console.log(`    ${percentage.padStart(5)}% ${bar} "${text}"`);
  });
  console.log();

  // Example 4: Blend audio and text embeddings
  console.log('Example 4: Blending audio and text embeddings...');
  
  const textPrompt = "Similar vibe but faster tempo";
  const textEmbed = await clap.encodeText(textPrompt);

  // Try different blending weights
  const blendingWeights = [0.2, 0.5, 0.8];
  
  blendingWeights.forEach(audioWeight => {
    const blended = clap.blendEmbeddings(audioEmbed, textEmbed, audioWeight);
    const textWeight = 1 - audioWeight;
    console.log(`  ${(audioWeight * 100).toFixed(0)}% audio + ${(textWeight * 100).toFixed(0)}% text → ${blended.length} dim embedding`);
  });
  console.log();

  // Example 5: Generate music with audio reference
  console.log('Example 5: Generating music with audio reference...');
  console.log('  Reference: Existing track');
  console.log('  Text: "Similar vibe but faster"');
  console.log('  Audio weight: 60%\n');

  // In a real implementation, this would use the blended embedding
  // For now, we just demonstrate the API
  console.log('  Generating...');
  const stems = await generateMusic({
    text: "Similar vibe but faster",
    bpm: 140,
    bars: 32,
    quality: 'balanced',
    // audioReference: audioEmbed, // Would pass the embedding here
    // audioReferenceWeight: 0.6,
  });

  console.log(`  Generated ${stems.length} stems\n`);

  console.log('✓ Example complete!');
  console.log('CLAP use cases:');
  console.log('  • Find similar tracks in a music library');
  console.log('  • Generate variations of existing music');
  console.log('  • Match style and mood of reference tracks');
  console.log('  • Blend multiple references with text prompts');
}

// Run the example
clapExample().catch(console.error);
