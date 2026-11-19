/**
 * MIDI File I/O – NAW 1.4
 *
 * Parses and writes Standard MIDI Files. Includes noteNameToMidi for pitch/drum labels,
 * input validation, and note-off priority so same-tick offs sort before note-ons.
 */

import type { NoteEvent } from '../../types';

export interface MidiFileEvent {
  tick: number;
  status: number;
  data1: number;
  data2: number;
  metaType?: number;
  metaData?: Uint8Array;
}

export interface MidiFileTrack {
  name: string;
  events: MidiFileEvent[];
}

export interface MidiFile {
  format: 0 | 1;
  ticksPerQuarterNote: number;
  tracks: MidiFileTrack[];
  microsecondsPerBeat: number;
}

function readVlq(view: DataView, offset: number): [number, number] {
  let value = 0;
  let bytesRead = 0;
  let b: number;
  do {
    b = view.getUint8(offset + bytesRead);
    value = (value << 7) | (b & 0x7F);
    bytesRead++;
  } while (b & 0x80 && bytesRead < 4);
  return [value >>> 0, bytesRead];
}

function encodeVlq(value: number): number[] {
  const bytes: number[] = [];
  bytes.push(value & 0x7F);
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7F) | 0x80);
    value >>= 7;
  }
  return bytes;
}

/** Convert a supported NAW note label to a General MIDI note number. */
export function noteNameToMidi(note: string | number): number {
  if (typeof note === 'number') {
    if (!Number.isInteger(note) || note < 0 || note > 127) {
      throw new RangeError(`MIDI note number must be an integer from 0 to 127: ${note}`);
    }
    return note;
  }
  const drumNotes: Record<string, number> = { KICK: 36, SNARE: 38, CHAT: 42, OHAT: 46 };
  const normalized = note.trim().toUpperCase();
  if (drumNotes[normalized] !== undefined) return drumNotes[normalized];
  const match = /^([A-G])([#B]?)(-?\d+)$/.exec(normalized);
  if (!match) throw new Error(`Unsupported MIDI note label: ${note}`);
  const pitchClasses: Record<string, number> = {
    C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4,
    F: 5, 'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8,
    A: 9, 'A#': 10, BB: 10, B: 11,
  };
  const midiNote = (Number(match[3]) + 1) * 12 + pitchClasses[`${match[1]}${match[2]}`];
  if (!Number.isInteger(midiNote) || midiNote < 0 || midiNote > 127) {
    throw new RangeError(`MIDI note is outside the supported range: ${note}`);
  }
  return midiNote;
}

export class MidiFileParser {
  static parse(buffer: ArrayBuffer): MidiFile {
    const view = new DataView(buffer);
    let offset = 0;
    const headerMagic = view.getUint32(offset, false);
    if (headerMagic !== 0x4D546864) throw new Error('Not a valid MIDI file: missing MThd header');
    offset += 4;
    const headerLen = view.getUint32(offset, false);
    offset += 4;
    const format = view.getUint16(offset, false) as 0 | 1;
    offset += 2;
    const numTracks = view.getUint16(offset, false);
    offset += 2;
    const division = view.getUint16(offset, false);
    offset += 2;
    offset += Math.max(0, headerLen - 6);
    const ticksPerQuarterNote = division & 0x8000 ? 480 : division;
    const tracks: MidiFileTrack[] = [];
    let microsecondsPerBeat = 500000;
    for (let t = 0; t < numTracks; t++) {
      const trackMagic = view.getUint32(offset, false);
      if (trackMagic !== 0x4D54726B) throw new Error(`Track ${t}: missing MTrk header`);
      offset += 4;
      const trackLen = view.getUint32(offset, false);
      offset += 4;
      const trackEnd = offset + trackLen;
      const track = MidiFileParser._parseTrack(view, offset, trackEnd);
      tracks.push(track.track);
      if (track.microsecondsPerBeat) microsecondsPerBeat = track.microsecondsPerBeat;
      offset = trackEnd;
    }
    return { format, ticksPerQuarterNote, tracks, microsecondsPerBeat };
  }

  private static _parseTrack(view: DataView, start: number, end: number): { track: MidiFileTrack; microsecondsPerBeat?: number } {
    const events: MidiFileEvent[] = [];
    let offset = start;
    let absoluteTick = 0;
    let runningStatus = 0;
    let trackName = '';
    let microsecondsPerBeat: number | undefined;
    while (offset < end) {
      const [delta, deltaBytes] = readVlq(view, offset);
      offset += deltaBytes;
      absoluteTick += delta;
      let status = view.getUint8(offset);
      if (status & 0x80) { runningStatus = status; offset++; } else { status = runningStatus; }
      const statusHigh = status & 0xF0;
      if (status === 0xFF) {
        const metaType = view.getUint8(offset++);
        const [metaLen, metaLenBytes] = readVlq(view, offset);
        offset += metaLenBytes;
        const metaData = new Uint8Array(view.buffer, offset, metaLen);
        offset += metaLen;
        if (metaType === 0x03) trackName = new TextDecoder().decode(metaData);
        else if (metaType === 0x51 && metaLen === 3) microsecondsPerBeat = (metaData[0] << 16) | (metaData[1] << 8) | metaData[2];
        events.push({ tick: absoluteTick, status, data1: 0, data2: 0, metaType, metaData });
      } else if (status === 0xF0 || status === 0xF7) {
        const [sysexLen, sysexLenBytes] = readVlq(view, offset);
        offset += sysexLenBytes + sysexLen;
      } else if (statusHigh >= 0x80 && statusHigh <= 0xE0) {
        const data1 = view.getUint8(offset++);
        const hasTwoBytes = statusHigh !== 0xC0 && statusHigh !== 0xD0;
        const data2 = hasTwoBytes ? view.getUint8(offset++) : 0;
        events.push({ tick: absoluteTick, status, data1, data2 });
      } else { offset++; }
    }
    return { track: { name: trackName, events }, microsecondsPerBeat };
  }

  static toNoteEvents(track: MidiFileTrack, ticksPerBeat: number, bpm: number, stepsPerBeat = 4): NoteEvent[] {
    const noteOnMap = new Map<number, { tick: number; velocity: number }>();
    const noteEvents: NoteEvent[] = [];
    const ticksToSteps = (ticks: number) => Math.round((ticks / ticksPerBeat) * stepsPerBeat);
    for (const ev of track.events) {
      const statusHigh = ev.status & 0xF0;
      const isNoteOn = statusHigh === 0x90 && ev.data2 > 0;
      const isNoteOff = statusHigh === 0x80 || (statusHigh === 0x90 && ev.data2 === 0);
      if (isNoteOn) noteOnMap.set(ev.data1, { tick: ev.tick, velocity: ev.data2 });
      else if (isNoteOff) {
        const noteOn = noteOnMap.get(ev.data1);
        if (noteOn) {
          const step = ticksToSteps(noteOn.tick);
          const duration = Math.max(1, ticksToSteps(ev.tick - noteOn.tick));
          noteEvents.push({ step, note: ev.data1, duration, velocity: noteOn.velocity / 127 });
          noteOnMap.delete(ev.data1);
        }
      }
    }
    for (const [note, noteOn] of noteOnMap) {
      const step = ticksToSteps(noteOn.tick);
      noteEvents.push({ step, note, duration: stepsPerBeat, velocity: noteOn.velocity / 127 });
    }
    noteEvents.sort((a, b) => a.step - b.step);
    return noteEvents;
  }
}

export class MidiFileWriter {
  static write(events: NoteEvent[], options: { bpm?: number; ppqn?: number; channel?: number } = {}): ArrayBuffer {
    const bpm = options.bpm ?? 120;
    const ppqn = options.ppqn ?? 480;
    const channel = options.channel ?? 0;
    if (!Number.isFinite(bpm) || bpm <= 0 || bpm > 1000) throw new RangeError('BPM must be greater than 0 and no more than 1000.');
    if (!Number.isInteger(ppqn) || ppqn < 1 || ppqn > 0x7FFF) throw new RangeError('PPQN must be an integer from 1 to 32767.');
    if (!Number.isInteger(channel) || channel < 0 || channel > 15) throw new RangeError('MIDI channel must be an integer from 0 to 15.');
    const ch = channel & 0x0F;
    const uspb = Math.round(60_000_000 / bpm);
    const sorted = [...events].map(event => {
      const midiNote = noteNameToMidi(event.note);
      const velocity = Number(event.velocity);
      const step = Number(event.step);
      const duration = Number(event.duration);
      if (!Number.isFinite(velocity) || velocity < 0 || velocity > 1) throw new RangeError('Velocity must be between 0 and 1.');
      if (!Number.isFinite(step) || step < 0) throw new RangeError('Step must be a non-negative number.');
      if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Duration must be greater than 0.');
      return { ...event, midiNote, velocity, step, duration };
    }).sort((a, b) => a.step - b.step);
    const raw: number[] = [];
    raw.push(0x00, 0xFF, 0x51, 0x03, (uspb >> 16) & 0xFF, (uspb >> 8) & 0xFF, uspb & 0xFF);
    type MidiRawEvent = { tick: number; priority: number; bytes: number[] };
    const midiEvents: MidiRawEvent[] = [];
    const stepsPerBeat = 4;
    const ticksPerStep = ppqn / stepsPerBeat;
    for (const ev of sorted) {
      const note = ev.midiNote;
      const velocity = Math.round(ev.velocity * 127);
      const startTick = Math.round(ev.step * ticksPerStep);
      const endTick = startTick + Math.max(1, Math.round(ev.duration * ticksPerStep));
      midiEvents.push({ tick: startTick, priority: 1, bytes: [0x90 | ch, note & 0x7F, velocity] });
      midiEvents.push({ tick: endTick, priority: 0, bytes: [0x80 | ch, note & 0x7F, 0] });
    }
    midiEvents.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
    let lastTick = 0;
    for (const ev of midiEvents) {
      const delta = ev.tick - lastTick;
      raw.push(...encodeVlq(delta), ...ev.bytes);
      lastTick = ev.tick;
    }
    raw.push(0x00, 0xFF, 0x2F, 0x00);
    const trackLen = raw.length;
    const buf = new ArrayBuffer(14 + 8 + trackLen);
    const view = new DataView(buf);
    let off = 0;
    view.setUint32(off, 0x4D546864, false); off += 4;
    view.setUint32(off, 6, false); off += 4;
    view.setUint16(off, 0, false); off += 2;
    view.setUint16(off, 1, false); off += 2;
    view.setUint16(off, ppqn, false); off += 2;
    view.setUint32(off, 0x4D54726B, false); off += 4;
    view.setUint32(off, trackLen, false); off += 4;
    for (const byte of raw) view.setUint8(off++, byte);
    return buf;
  }
}
