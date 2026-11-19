import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { MidiRecordingBuffer } from './MidiRecordingBuffer';

test('pairs note-on and note-off and calculates held duration', () => {
  const buffer = new MidiRecordingBuffer();
  buffer.begin('keyboard-1', 0, 60, {
    eventId: 'event-1',
    trackId: 'track-1',
    startAbsoluteStep: 24,
  });

  assert.deepEqual(buffer.finish('keyboard-1', 0, 60, 31), {
    eventId: 'event-1',
    trackId: 'track-1',
    duration: 7,
  });
  assert.equal(buffer.size, 0);
});

test('does not pair notes from different channels or devices', () => {
  const buffer = new MidiRecordingBuffer();
  buffer.begin('keyboard-1', 0, 60, {
    eventId: 'event-1',
    trackId: 'track-1',
    startAbsoluteStep: 0,
  });
  assert.equal(buffer.finish('keyboard-1', 1, 60, 8), null);
  assert.equal(buffer.finish('keyboard-2', 0, 60, 8), null);
  assert.equal(buffer.size, 1);
});

test('enforces a minimum duration of one sixteenth note', () => {
  const buffer = new MidiRecordingBuffer();
  buffer.begin('keyboard-1', 0, 64, {
    eventId: 'event-2',
    trackId: 'track-1',
    startAbsoluteStep: 12,
  });
  assert.equal(buffer.finish('keyboard-1', 0, 64, 12)?.duration, 1);
});
