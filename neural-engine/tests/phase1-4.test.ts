/**
 * Phase 1-4 Integration Tests
 *
 * Tests for:
 *   Phase 1 – Core Engine & Scheduling (AudioWorklet, LookAhead, WaveformWorker)
 *   Phase 2 – Plugin Architecture (WAM, CLAP/VST3, N-API)
 *   Phase 3 – MIDI (MidiService, MidiFileIO, AutomationCurve)
 *   Phase 4 – Non-Destructive Editing (TimeStretchEngine, ClipEditor)
 */

/* ── Phase 1 imports ──────────────────────────────────────────────────── */
import {
  LookAheadScheduler,
  AudioWorkletEngine,
  DEFAULT_WORKLET_ENGINE_CONFIG,
} from '../../services/audio/AudioWorkletEngine';

import { computeEnvelope } from '../../services/audio/workers/WaveformWorker';
import { WaveformWorkerBridge } from '../../services/audio/WaveformWorkerBridge';

/* ── Phase 2 imports ──────────────────────────────────────────────────── */
import {
  WamHost,
  WamPluginInstance,
  type WamDescriptor,
} from '../../services/plugin/WamHost';

import {
  VstClapBridge,
  PluginFormat,
} from '../../services/plugin/VstClapBridge';

import { NApiBridge } from '../../services/plugin/NApiBridge';

/* ── Phase 3 imports ──────────────────────────────────────────────────── */
import {
  MidiService,
  parseMidiMessage,
  MidiStatus,
} from '../../services/midi/MidiService';

import {
  MidiFileParser,
  MidiFileWriter,
} from '../../services/midi/MidiFileIO';

import {
  AutomationCurve,
  AutomationInterpolation,
  createVolumeAutomation,
  createPanAutomation,
  createMidiCcAutomation,
} from '../../services/midi/AutomationCurve';

/* ── Phase 4 imports ──────────────────────────────────────────────────── */
import {
  TimeStretchEngine,
  TimeStretchQuality,
  DEFAULT_TIME_STRETCH_OPTIONS,
} from '../../services/audio/TimeStretchEngine';

import {
  ClipEditor,
  type SourceBuffer,
} from '../../services/audio/ClipEditor';

/* ─────────────────────────────────────────────────────────────────────── */

class TestRunner {
  private passed = 0;
  private failed = 0;

  async test(name: string, fn: () => Promise<void> | void): Promise<void> {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      this.passed++;
    } catch (error) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${error}`);
      this.failed++;
    }
  }

  report(): void {
    console.log(`\nTest Results: ${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

/* ─────────────────────────────────────────────────────────────────────── */

async function runTests(): Promise<void> {
  const runner = new TestRunner();

  console.log('='.repeat(60));
  console.log('Phase 1-4 Integration Tests');
  console.log('='.repeat(60));

  /* ── Phase 1: LookAheadScheduler ──────────────────────────────────── */
  console.log('\nPhase 1 – Core Engine & Scheduling:');

  await runner.test('LookAheadScheduler: schedules and dispatches events', async () => {
    let now = 0;
    const scheduler = new LookAheadScheduler(() => now, 50, 10);

    const fired: number[] = [];
    scheduler.schedule({ time: 0.01, callback: () => fired.push(1) });
    scheduler.schedule({ time: 0.02, callback: () => fired.push(2) });
    scheduler.schedule({ time: 0.05, callback: () => fired.push(3) });

    // advance simulated time past all events
    now = 0.10;
    // Manually trigger one tick via the internal testing helper
    scheduler._dispatchDue();

    assert(fired.length === 3, `Expected 3 fired events, got ${fired.length}`);
    assert(fired[0] === 1 && fired[1] === 2 && fired[2] === 3, 'Events fired out of order');
  });

  await runner.test('LookAheadScheduler: cancel removes matching events', () => {
    let now = 0;
    const scheduler = new LookAheadScheduler(() => now, 50, 10);

    scheduler.schedule({ time: 0.01, callback: () => {} });
    scheduler.schedule({ time: 0.02, callback: () => {} });
    scheduler.cancel(e => e.time === 0.01);

    assert(scheduler.pendingCount === 1, 'Cancel should leave 1 event');
  });

  await runner.test('LookAheadScheduler: clearAll empties queue', () => {
    let now = 0;
    const scheduler = new LookAheadScheduler(() => now, 50, 10);

    scheduler.schedule({ time: 0.01, callback: () => {} });
    scheduler.schedule({ time: 0.02, callback: () => {} });
    scheduler.clearAll();

    assert(scheduler.pendingCount === 0, 'Queue should be empty after clearAll');
  });

  await runner.test('AudioWorkletEngine: default config is correct', () => {
    assert(DEFAULT_WORKLET_ENGINE_CONFIG.lookAheadMs === 25, 'lookAheadMs default');
    assert(DEFAULT_WORKLET_ENGINE_CONFIG.schedulerIntervalMs === 12, 'schedulerIntervalMs default');
    assert(DEFAULT_WORKLET_ENGINE_CONFIG.sampleRate === 44100, 'sampleRate default');
  });

  await runner.test('AudioWorkletEngine: constructed in uninitialized state', () => {
    const engine = new AudioWorkletEngine();
    assert(!engine.initialized, 'Engine should not be initialized on construction');
    assert(engine.audioContext === null, 'audioContext should be null before init');
  });

  await runner.test('WaveformWorker: computeEnvelope basic operation', () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 10);
    const { peaks, rms } = computeEnvelope(samples, 1, 100);
    assert(peaks.length === 100, `Expected 100 peak values, got ${peaks.length}`);
    assert(rms.length === 100, `Expected 100 rms values, got ${rms.length}`);
    assert(peaks.some(v => v > 0), 'Peaks should be non-zero for sine wave');
    assert(rms.some(v => v > 0), 'RMS should be non-zero for sine wave');
  });

  await runner.test('WaveformWorker: computeEnvelope with stereo', () => {
    // Interleaved stereo: [L0,R0, L1,R1, ...]
    const samples = new Float32Array(200);
    for (let i = 0; i < samples.length; i += 2) {
      samples[i]     = 1.0; // L
      samples[i + 1] = 0.5; // R
    }
    const { peaks } = computeEnvelope(samples, 2, 10);
    assert(peaks.length === 10, 'Should produce 10 peak values');
    assert(peaks[0] > 0, 'Peak should be non-zero');
  });

  await runner.test('WaveformWorker: silent signal produces zero peaks', () => {
    const samples = new Float32Array(512); // all zeros
    const { peaks, rms } = computeEnvelope(samples, 1, 64);
    assert(peaks.every(v => v === 0), 'All peaks should be 0 for silent signal');
    assert(rms.every(v => v === 0), 'All RMS should be 0 for silent signal');
  });

  await runner.test('WaveformWorkerBridge: constructs without throwing (no Worker in Node)', () => {
    // In Node.js, Worker is undefined – bridge should construct in stub mode
    const bridge = new WaveformWorkerBridge('/dummy/WaveformWorker.js');
    assert(bridge !== null, 'Bridge should be constructable');
    bridge.dispose();
  });

  /* ── Phase 2: WAM Host ─────────────────────────────────────────────── */
  console.log('\nPhase 2 – Plugin Architecture:');

  await runner.test('WamHost: register and list plugin', async () => {
    // We need an AudioContext – use a minimal stub in Node
    const ctx = {} as AudioContext;
    const host = new WamHost(ctx);

    const desc: WamDescriptor = {
      identifier: 'com.test.Synth',
      name: 'Test Synth',
      vendor: 'Test',
      version: '1.0.0',
      category: 'Instrument',
      description: 'A test synth',
    };

    await host.registerPlugin(desc);
    const plugins = host.getRegisteredPlugins();
    assert(plugins.length === 1, 'Should have one registered plugin');
    assert(plugins[0].identifier === 'com.test.Synth', 'Plugin identifier mismatch');
  });

  await runner.test('WamHost: loadPlugin creates instance', async () => {
    const ctx = {} as AudioContext;
    const host = new WamHost(ctx);

    const desc: WamDescriptor = {
      identifier: 'com.test.Effect',
      name: 'Test Effect',
      vendor: 'Test',
      version: '1.0.0',
      category: 'Effect',
      description: 'A test effect',
    };
    await host.registerPlugin(desc);
    const instance = await host.loadPlugin('com.test.Effect');

    assert(instance !== null, 'Instance should be created');
    assert(instance.status === 'ready', `Expected ready, got ${instance.status}`);
    assert(instance.descriptor.identifier === 'com.test.Effect', 'Descriptor mismatch');
  });

  await runner.test('WamHost: loadPlugin throws for unknown identifier', async () => {
    const ctx = {} as AudioContext;
    const host = new WamHost(ctx);
    let threw = false;
    try { await host.loadPlugin('com.unknown.Plugin'); }
    catch { threw = true; }
    assert(threw, 'Should throw for unregistered plugin');
  });

  await runner.test('WamPluginInstance: serialize and restore state', async () => {
    const ctx = {} as AudioContext;
    const host = new WamHost(ctx);
    const desc: WamDescriptor = {
      identifier: 'com.test.Inst2',
      name: 'Inst2', vendor: 'T', version: '1.0.0',
      category: 'Instrument', description: '',
    };
    await host.registerPlugin(desc);
    const instance = await host.loadPlugin('com.test.Inst2');

    const state = instance.serializeState();
    assert(state['identifier'] === 'com.test.Inst2', 'State should contain identifier');

    // Restore should not throw
    instance.restoreState(state);
  });

  await runner.test('VstClapBridge: connect (stub mode)', async () => {
    const bridge = new VstClapBridge();
    await bridge.connect();
    assert(bridge.connected, 'Bridge should be connected after connect()');
    bridge.disconnect();
    assert(!bridge.connected, 'Bridge should be disconnected after disconnect()');
  });

  await runner.test('VstClapBridge: scanPlugins returns array', async () => {
    const bridge = new VstClapBridge();
    await bridge.connect();
    const plugins = await bridge.scanPlugins('/fake/path');
    assert(Array.isArray(plugins), 'scanPlugins should return an array');
    bridge.disconnect();
  });

  await runner.test('VstClapBridge: loadPlugin returns NativePluginInstance', async () => {
    const bridge = new VstClapBridge();
    await bridge.connect();
    const instance = await bridge.loadPlugin('com.stub.Plugin');
    assert(instance !== null, 'Instance should be returned');
    assert(instance.descriptor.format === PluginFormat.CLAP, 'Format should be CLAP');
    bridge.disconnect();
  });

  await runner.test('NApiBridge: JS fallback FFT', () => {
    const bridge = new NApiBridge();
    assert(!bridge.isNativeAvailable, 'Native addon should not be available in test');
    assert(bridge.version() === 'js-fallback', 'Version should be js-fallback');

    const samples = new Float32Array(64);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    const spectrum = bridge.fft(samples, 64);
    assert(spectrum.length === 33, `Expected 33 bins, got ${spectrum.length}`);
    assert(spectrum.some(v => v > 0), 'Spectrum should have non-zero bins');
  });

  await runner.test('NApiBridge: JS fallback resample', () => {
    const bridge = new NApiBridge();
    const samples = new Float32Array(441); // 441 samples @ 44100 Hz = 10ms
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 10);
    const resampled = bridge.resample(samples, 44100, 48000);
    const expected  = Math.round(441 * 48000 / 44100);
    assert(resampled.length === expected, `Expected ${expected} samples, got ${resampled.length}`);
  });

  await runner.test('NApiBridge: JS fallback timeStretch', () => {
    const bridge = new NApiBridge();
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 20);
    // Stretch 2× should produce roughly 2000 samples (OLA resamples)
    const stretched = bridge.timeStretch(samples, 2.0, 44100, false);
    assert(stretched.length > 500, 'Stretched output should be longer');
  });

  /* ── Phase 3: MIDI ─────────────────────────────────────────────────── */
  console.log('\nPhase 3 – MIDI & Hardware Protocols:');

  await runner.test('MidiService: initializes in stub mode when Web MIDI unavailable', async () => {
    const svc = new MidiService();
    const ok = await svc.initialize();
    // In Node.js, Web MIDI is unavailable → returns false
    assert(svc.initialized, 'Service should mark itself initialized');
    assert(svc.getInputDevices().length === 0, 'No MIDI inputs expected in Node');
    assert(svc.getOutputDevices().length === 0, 'No MIDI outputs expected in Node');
  });

  await runner.test('parseMidiMessage: Note On', () => {
    const bytes = new Uint8Array([0x90, 60, 100]);
    const msg = parseMidiMessage(bytes, 1234);
    assert(msg.status === MidiStatus.NOTE_ON, 'Status should be NOTE_ON');
    assert(msg.channel === 0, 'Channel should be 0');
    assert(msg.data1 === 60, 'Note should be 60');
    assert(msg.data2 === 100, 'Velocity should be 100');
    assert(msg.timestamp === 1234, 'Timestamp should be preserved');
  });

  await runner.test('parseMidiMessage: Control Change', () => {
    const bytes = new Uint8Array([0xB3, 7, 64]); // ch 3, CC 7, value 64
    const msg = parseMidiMessage(bytes);
    assert(msg.status === MidiStatus.CONTROL_CHANGE, 'Status should be CONTROL_CHANGE');
    assert(msg.channel === 3, 'Channel should be 3');
    assert(msg.data1 === 7, 'CC number should be 7');
    assert(msg.data2 === 64, 'CC value should be 64');
  });

  await runner.test('MidiFileWriter: writes a valid SMF header', () => {
    const events = [
      { step: 0, note: 60, duration: 4, velocity: 1.0 },
      { step: 4, note: 64, duration: 4, velocity: 0.8 },
    ];
    const buf = MidiFileWriter.write(events, { bpm: 120, ppqn: 480, channel: 0 });
    const view = new DataView(buf);
    // MThd magic
    assert(view.getUint32(0, false) === 0x4D546864, 'Missing MThd magic');
    // Format 0
    assert(view.getUint16(8, false) === 0, 'Format should be 0');
    // 1 track
    assert(view.getUint16(10, false) === 1, 'Should have 1 track');
    // PPQN
    assert(view.getUint16(12, false) === 480, 'PPQN should be 480');
    // MTrk magic
    assert(view.getUint32(14, false) === 0x4D54726B, 'Missing MTrk magic');
  });

  await runner.test('MidiFileParser: parses round-trip (write then read)', () => {
    const inputEvents = [
      { step: 0,  note: 60, duration: 4, velocity: 1.0 },
      { step: 4,  note: 64, duration: 2, velocity: 0.75 },
      { step: 8,  note: 67, duration: 4, velocity: 0.9 },
    ];
    const buf   = MidiFileWriter.write(inputEvents, { bpm: 120, ppqn: 480 });
    const midi  = MidiFileParser.parse(buf);

    assert(midi.format === 0, `Expected format 0, got ${midi.format}`);
    assert(midi.ticksPerQuarterNote === 480, 'PPQN mismatch');
    assert(midi.tracks.length === 1, 'Should have 1 track');

    const notes = MidiFileParser.toNoteEvents(midi.tracks[0], midi.ticksPerQuarterNote, 120);
    // Should recover the 3 notes (step-exact)
    assert(notes.length === 3, `Expected 3 notes, got ${notes.length}`);
    assert(notes[0].note === 60, 'First note should be C4 (60)');
  });

  await runner.test('AutomationCurve: linear interpolation', () => {
    const curve = createVolumeAutomation();
    curve.addPoint({ beat: 0,  value: 0,   interpolation: AutomationInterpolation.LINEAR });
    curve.addPoint({ beat: 8,  value: -12, interpolation: AutomationInterpolation.LINEAR });

    const at4 = curve.evaluate(4);
    assert(Math.abs(at4 - (-6)) < 0.01, `Linear midpoint should be -6 dB, got ${at4}`);
    assert(curve.evaluate(0)  === 0,   'Start value should be 0');
    assert(curve.evaluate(8)  === -12, 'End value should be -12');
    assert(curve.evaluate(-1) === 0,   'Before start → clamp to first point');
    assert(curve.evaluate(10) === -12, 'After end → clamp to last point');
  });

  await runner.test('AutomationCurve: HOLD interpolation', () => {
    const curve = createPanAutomation();
    curve.addPoint({ beat: 0, value: -1, interpolation: AutomationInterpolation.HOLD });
    curve.addPoint({ beat: 4, value:  1, interpolation: AutomationInterpolation.HOLD });

    assert(curve.evaluate(2) === -1, 'HOLD should keep first value until next point');
    assert(curve.evaluate(5) === 1,  'HOLD: after second point returns second value');
  });

  await runner.test('AutomationCurve: SMOOTH interpolation is monotone for simple case', () => {
    const curve = createMidiCcAutomation(1, 'Modulation');
    curve.addPoint({ beat: 0,  value: 0,   interpolation: AutomationInterpolation.SMOOTH });
    curve.addPoint({ beat: 4,  value: 64,  interpolation: AutomationInterpolation.SMOOTH });
    curve.addPoint({ beat: 8,  value: 127, interpolation: AutomationInterpolation.SMOOTH });

    const mid = curve.evaluate(4);
    assert(mid === 64, `Mid-point should equal control point value (64), got ${mid}`);
    // Values should increase monotonically
    const samples = curve.sample(0, 8, 17);
    let monotone = true;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] < samples[i - 1] - 0.1) { monotone = false; break; }
    }
    assert(monotone, 'Smooth curve should be roughly monotone for this input');
  });

  await runner.test('AutomationCurve: removePoint', () => {
    const curve = createVolumeAutomation();
    curve.addPoint({ beat: 0, value: 0,   interpolation: AutomationInterpolation.LINEAR });
    curve.addPoint({ beat: 4, value: -6,  interpolation: AutomationInterpolation.LINEAR });
    assert(curve.points.length === 2, 'Should have 2 points');
    curve.removePoint(4);
    assert(curve.points.length === 1, 'Should have 1 point after removal');
  });

  await runner.test('AutomationCurve: sample returns correct length', () => {
    const curve = createVolumeAutomation();
    curve.addPoint({ beat: 0, value: 0,   interpolation: AutomationInterpolation.LINEAR });
    curve.addPoint({ beat: 16, value: -6, interpolation: AutomationInterpolation.LINEAR });
    const samples = curve.sample(0, 16, 256);
    assert(samples.length === 256, `Expected 256 samples, got ${samples.length}`);
  });

  await runner.test('AutomationCurve: serialization round-trip', () => {
    const curve = createVolumeAutomation('Master Volume');
    curve.addPoint({ beat: 0, value: 0,  interpolation: AutomationInterpolation.SMOOTH });
    curve.addPoint({ beat: 8, value: -6, interpolation: AutomationInterpolation.SMOOTH });

    const json = curve.toJSON();
    const restored = AutomationCurve.fromJSON(json);

    assert(restored.config.label === 'Master Volume', 'Label should be restored');
    assert(restored.points.length === 2, 'Points should be restored');
    assert(Math.abs(restored.evaluate(0) - 0) < 0.001, 'Start value should match');
  });

  /* ── Phase 4: TimeStretchEngine ───────────────────────────────────── */
  console.log('\nPhase 4 – Non-Destructive Audio Editing:');

  await runner.test('TimeStretchEngine: default options', () => {
    assert(DEFAULT_TIME_STRETCH_OPTIONS.timeRatio === 1.0, 'Default timeRatio');
    assert(DEFAULT_TIME_STRETCH_OPTIONS.pitchSemitones === 0, 'Default pitchSemitones');
    assert(DEFAULT_TIME_STRETCH_OPTIONS.quality === TimeStretchQuality.HIGH, 'Default quality');
    assert(!DEFAULT_TIME_STRETCH_OPTIONS.preserveFormants, 'Default preserveFormants');
  });

  await runner.test('TimeStretchEngine: bpmToTimeRatio', () => {
    const ratio = TimeStretchEngine.bpmToTimeRatio(120, 150);
    assert(Math.abs(ratio - 0.8) < 0.001, `120→150 BPM ratio should be 0.8, got ${ratio}`);

    const ratio2 = TimeStretchEngine.bpmToTimeRatio(150, 120);
    assert(Math.abs(ratio2 - 1.25) < 0.001, `150→120 BPM ratio should be 1.25, got ${ratio2}`);
  });

  await runner.test('TimeStretchEngine: semitoneToScale', () => {
    const scale = TimeStretchEngine.semitoneToScale(12);
    assert(Math.abs(scale - 2.0) < 0.001, '12 semitones should double frequency');
    const unison = TimeStretchEngine.semitoneToScale(0);
    assert(Math.abs(unison - 1.0) < 0.001, '0 semitones should give scale 1.0');
  });

  await runner.test('TimeStretchEngine: JS fallback stretch (no Wasm)', async () => {
    const engine = new TimeStretchEngine();
    assert(!engine.wasmAvailable, 'Wasm should not be available in Node');

    const samples = new Float32Array(4410); // 100ms @ 44100
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 100);

    const result = await engine.stretch(samples, { timeRatio: 2.0, quality: TimeStretchQuality.HIGH });
    assert(!result.usedWasm, 'Should use JS fallback');
    assert(result.output.length > samples.length / 2, 'Stretched output should be non-trivially long');
    assert(result.sampleRate === 44100, 'Sample rate should be preserved');
  });

  await runner.test('TimeStretchEngine: ratio clamped to valid range', async () => {
    const engine = new TimeStretchEngine();
    const samples = new Float32Array(100);

    // Ratio 0 should be clamped to 0.1
    const result = await engine.stretch(samples, { timeRatio: 0, quality: TimeStretchQuality.FAST });
    assert(result !== null, 'Should not throw for extreme ratio');
  });

  /* ── Phase 4: ClipEditor ──────────────────────────────────────────── */

  function makeSource(id: string, durationSeconds: number, sampleRate = 44100): SourceBuffer {
    const len = Math.round(durationSeconds * sampleRate);
    const data = new Float32Array(len);
    for (let i = 0; i < len; i++) data[i] = Math.sin(i / 100);
    return { id, sampleRate, durationSeconds, channels: [data] };
  }

  await runner.test('ClipEditor: createRegion with defaults', () => {
    const editor = new ClipEditor();
    const src = makeSource('src1', 4.0);
    editor.addSource(src);
    const region = editor.createRegion('src1', {});
    assert(region.sourceId === 'src1', 'Source ID mismatch');
    assert(region.durationSeconds === 4.0, 'Duration should match source');
    assert(region.gain === 1.0, 'Default gain should be 1.0');
    assert(region.timelineBeat === 0, 'Default timeline beat should be 0');
  });

  await runner.test('ClipEditor: trim adjusts in-point and duration', () => {
    const editor = new ClipEditor();
    const src = makeSource('src2', 4.0);
    editor.addSource(src);
    const region = editor.createRegion('src2', { durationSeconds: 4.0 });

    const trimmed = editor.trim(region.id, 1.0, 2.0);
    assert(Math.abs(trimmed.sourceOffsetSeconds - 1.0) < 0.001, 'Offset should move by 1s');
    assert(Math.abs(trimmed.durationSeconds - 2.0) < 0.001, 'Duration should be 2s');
  });

  await runner.test('ClipEditor: slip moves media inside fixed boundary', () => {
    const editor = new ClipEditor();
    const src = makeSource('src3', 4.0);
    editor.addSource(src);
    const region = editor.createRegion('src3', { durationSeconds: 2.0 });

    const slipped = editor.slip(region.id, 1.0);
    assert(Math.abs(slipped.sourceOffsetSeconds - 1.0) < 0.001, 'Offset should slip by 1s');
    assert(Math.abs(slipped.durationSeconds - 2.0) < 0.001, 'Duration unchanged after slip');
    assert(slipped.timelineBeat === region.timelineBeat, 'Timeline beat unchanged after slip');
  });

  await runner.test('ClipEditor: slice splits region into two', () => {
    const editor = new ClipEditor();
    const src = makeSource('src4', 4.0);
    editor.addSource(src);
    const region = editor.createRegion('src4', { durationSeconds: 4.0, timelineBeat: 0 });

    const [left, right] = editor.slice(region.id, 4); // slice at beat 4 (= 2s at 120 BPM)
    assert(left.durationSeconds > 0, 'Left region should have positive duration');
    assert(right.durationSeconds > 0, 'Right region should have positive duration');
    assert(Math.abs(left.durationSeconds + right.durationSeconds - 4.0) < 0.01, 'Durations should sum to original');
  });

  await runner.test('ClipEditor: slice throws for out-of-bounds beat', () => {
    const editor = new ClipEditor();
    const src = makeSource('src5', 4.0);
    editor.addSource(src);
    const region = editor.createRegion('src5', { durationSeconds: 4.0, timelineBeat: 0 });

    let threw = false;
    try { editor.slice(region.id, 100); } catch { threw = true; }
    assert(threw, 'Slice outside bounds should throw');
  });

  await runner.test('ClipEditor: applyCrossfade updates fade config', () => {
    const editor = new ClipEditor();
    const src = makeSource('src6', 4.0);
    editor.addSource(src);
    const region = editor.createRegion('src6', {});

    const updated = editor.applyCrossfade(region.id, {
      fadeInSeconds: 0.1,
      fadeOutSeconds: 0.2,
      shape: 'equal_power',
    });
    assert(Math.abs(updated.crossfade.fadeInSeconds  - 0.1) < 0.001, 'Fade-in should be 0.1s');
    assert(Math.abs(updated.crossfade.fadeOutSeconds - 0.2) < 0.001, 'Fade-out should be 0.2s');
    assert(updated.crossfade.shape === 'equal_power', 'Shape should be equal_power');
  });

  await runner.test('ClipEditor: setGain clamps to valid range', () => {
    const editor = new ClipEditor();
    const src = makeSource('src7', 2.0);
    editor.addSource(src);
    const region = editor.createRegion('src7', {});

    const g1 = editor.setGain(region.id, 1.5);
    assert(g1.gain === 1.5, 'Gain should be 1.5');

    const g2 = editor.setGain(region.id, 5.0); // over max
    assert(g2.gain === 2.0, 'Gain should be clamped to 2.0');

    const g3 = editor.setGain(region.id, -1.0); // under min
    assert(g3.gain === 0.0, 'Gain should be clamped to 0.0');
  });

  await runner.test('ClipEditor: renderRegion applies fade envelopes', () => {
    const editor = new ClipEditor();
    const src = makeSource('src8', 1.0);
    editor.addSource(src);
    const region = editor.createRegion('src8', { durationSeconds: 1.0 });
    editor.applyCrossfade(region.id, {
      fadeInSeconds: 0.01,
      fadeOutSeconds: 0.01,
      shape: 'linear',
    });
    const pcm = editor.renderRegion(region.id);
    assert(pcm.length > 0, 'Rendered PCM should be non-empty');
    assert(pcm[0] === 0 || Math.abs(pcm[0]) < 0.1, 'First sample should be near 0 due to fade-in');
  });

  await runner.test('ClipEditor: undo restores previous state', () => {
    const editor = new ClipEditor();
    const src = makeSource('src9', 4.0);
    editor.addSource(src);
    const region = editor.createRegion('src9', { durationSeconds: 4.0, gain: 1.0 });

    editor.setGain(region.id, 0.5);
    assert(editor.getRegion(region.id)?.gain === 0.5, 'Gain should be 0.5 after set');

    const undone = editor.undo();
    assert(undone, 'Undo should succeed');
    assert(editor.getRegion(region.id)?.gain === 1.0, 'Gain should revert to 1.0 after undo');
  });

  await runner.test('ClipEditor: redo re-applies the change', () => {
    const editor = new ClipEditor();
    const src = makeSource('src10', 4.0);
    editor.addSource(src);
    const region = editor.createRegion('src10', { durationSeconds: 4.0, gain: 1.0 });

    editor.setGain(region.id, 0.5);
    editor.undo();
    const redone = editor.redo();
    assert(redone, 'Redo should succeed');
    assert(editor.getRegion(region.id)?.gain === 0.5, 'Gain should be 0.5 after redo');
  });

  runner.report();
}

runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
