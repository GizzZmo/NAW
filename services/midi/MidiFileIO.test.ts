import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { MidiFileParser, MidiFileWriter, noteNameToMidi } from './MidiFileIO';

test('converts scientific pitch notation and NAW drum labels to General MIDI', () => {
  assert.equal(noteNameToMidi('C4'), 60);
  assert.equal(noteNameToMidi('F#3'), 54);
  assert.equal(noteNameToMidi('Db4'), 61);
  assert.equal(noteNameToMidi('KICK'), 36);
  assert.equal(noteNameToMidi('SNARE'), 38);
});

test('writes note names as their actual MIDI pitches', () => {
  const data = MidiFileWriter.write([
    { step: 0, note: 'C4', duration: 4, velocity: 0.8 },
    { step: 4, note: 'KICK', duration: 1, velocity: 1 },
  ]);
  const parsed = MidiFileParser.parse(data);
  const noteOns = parsed.tracks[0].events.filter(event => (event.status & 0xF0) === 0x90);
  assert.deepEqual(noteOns.map(event => event.data1), [60, 36]);
});

test('rejects invalid note labels and malformed note events', () => {
  assert.throws(() => noteNameToMidi('H4'), /Unsupported MIDI note/);
  assert.throws(() => noteNameToMidi(128), RangeError);
  assert.throws(() => MidiFileWriter.write([
    { step: -1, note: 'C4', duration: 1, velocity: 0.5 },
  ]), RangeError);
});

test('writes note-off before note-on for same-pitch retriggers at the same tick', () => {
  const data = MidiFileWriter.write([
    { step: 0, note: 'C4', duration: 4, velocity: 0.8 },
    { step: 4, note: 'C4', duration: 2, velocity: 0.7 },
  ]);
  const parsed = MidiFileParser.parse(data);
  const atTick = parsed.tracks[0].events.filter(event => event.tick === 480);
  assert.equal(atTick[0].status & 0xF0, 0x80);
  assert.equal(atTick[1].status & 0xF0, 0x90);
});
