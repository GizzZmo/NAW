/**
 * MIDI File I/O
 *
 * Phase 3 Implementation – MIDI & External Hardware Protocols
 *
 * Parses and writes Standard MIDI Files (.mid) format 0 and 1.
 * Allows users to drag-and-drop existing MIDI sequences into the NAW
 * timeline and export the current piano-roll content as a .mid file.
 *
 * SMF specification:
 *   https://www.midi.org/specifications-old/item/standard-midi-files-smf
 *
 * @see services/midi/MidiService.ts
 * @see ROADMAP.md § Phase 3.2
 */

import type { NoteEvent } from '../../types';

/* ──────────────────────────────────────────────────────────────────────────
 * SMF data structures
 * ──────────────────────────────────────────────────────────────────────── */

/** A decoded MIDI event within a track (absolute tick time). */
export interface MidiFileEvent {
  /** Absolute tick position */
  tick: number;
  /** Raw MIDI status byte */
  status: number;
  /** First data byte */
  data1: number;
  /** Second data byte */
  data2: number;
  /** Meta-event type (if status === 0xFF) */
  metaType?: number;
  /** Meta-event payload */
  metaData?: Uint8Array;
}

/** A decoded MIDI track. */
export interface MidiFileTrack {
  /** Track name (from META 0x03 event) */
  name: string;
  /** Events sorted by tick (ascending) */
  events: MidiFileEvent[];
}

/** Parsed Standard MIDI File. */
export interface MidiFile {
  /** SMF format: 0 = single track, 1 = multi-track simultaneous */
  format: 0 | 1;
  /** Ticks per quarter note (PPQN) */
  ticksPerQuarterNote: number;
  /** Decoded tracks */
  tracks: MidiFileTrack[];
  /** Tempo in µs/beat (default 500000 = 120 BPM) */
  microsecondsPerBeat: number;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Variable-length quantity helpers
 * ──────────────────────────────────────────────────────────────────────── */

/** Read a variable-length quantity from a DataView. Returns [value, bytesRead]. */
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

/** Encode a number as a variable-length quantity. */
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

/* ──────────────────────────────────────────────────────────────────────────
 * MidiFileParser
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Parses a Standard MIDI File (`.mid`) from an ArrayBuffer.
 *
 * @example
 * ```typescript
 * const bytes = await file.arrayBuffer();
 * const parsed = MidiFileParser.parse(bytes);
 * const notes = MidiFileParser.toNoteEvents(parsed.tracks[0], parsed.ticksPerQuarterNote, 120);
 * ```
 */
export class MidiFileParser {
  /**
   * Parse a MIDI file from raw binary data.
   *
   * @param buffer - ArrayBuffer containing the .mid file contents
   * @throws Error if the buffer is not a valid SMF file
   */
  static parse(buffer: ArrayBuffer): MidiFile {
    const view = new DataView(buffer);
    let offset = 0;

    // ── Header chunk ───────────────────────────────────────────────────
    const headerMagic = view.getUint32(offset, false);
    if (headerMagic !== 0x4D546864) { // "MThd"
      throw new Error('Not a valid MIDI file: missing MThd header');
    }
    offset += 4;
    const headerLen = view.getUint32(offset, false); // always 6
    offset += 4;
    const format = view.getUint16(offset, false) as 0 | 1;
    offset += 2;
    const numTracks = view.getUint16(offset, false);
    offset += 2;
    const division = view.getUint16(offset, false);
    offset += 2;
    offset += Math.max(0, headerLen - 6); // skip extra header bytes

    const ticksPerQuarterNote = division & 0x8000 ? 480 : division; // SMPTE fallback

    // ── Track chunks ───────────────────────────────────────────────────
    const tracks: MidiFileTrack[] = [];
    let microsecondsPerBeat = 500000; // 120 BPM default

    for (let t = 0; t < numTracks; t++) {
      const trackMagic = view.getUint32(offset, false);
      if (trackMagic !== 0x4D54726B) { // "MTrk"
        throw new Error(`Track ${t}: missing MTrk header`);
      }
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

  private static _parseTrack(
    view: DataView,
    start: number,
    end: number,
  ): { track: MidiFileTrack; microsecondsPerBeat?: number } {
    const events: MidiFileEvent[] = [];
    let offset = start;
    let absoluteTick = 0;
    let runningStatus = 0;
    let trackName = '';
    let microsecondsPerBeat: number | undefined;

    while (offset < end) {
      // Delta time
      const [delta, deltaBytes] = readVlq(view, offset);
      offset += deltaBytes;
      absoluteTick += delta;

      let status = view.getUint8(offset);

      // Running status: if high bit not set, reuse last status
      if (status & 0x80) {
        runningStatus = status;
        offset++;
      } else {
        status = runningStatus;
        // Do NOT advance offset for data byte when using running status
      }

      const statusHigh = status & 0xF0;

      if (status === 0xFF) {
        // Meta event
        const metaType = view.getUint8(offset++);
        const [metaLen, metaLenBytes] = readVlq(view, offset);
        offset += metaLenBytes;
        const metaData = new Uint8Array(view.buffer, offset, metaLen);
        offset += metaLen;

        if (metaType === 0x03) {
          // Track name
          trackName = new TextDecoder().decode(metaData);
        } else if (metaType === 0x51 && metaLen === 3) {
          // Tempo
          microsecondsPerBeat =
            (metaData[0] << 16) | (metaData[1] << 8) | metaData[2];
        }

        events.push({ tick: absoluteTick, status, data1: 0, data2: 0, metaType, metaData });
      } else if (status === 0xF0 || status === 0xF7) {
        // SysEx
        const [sysexLen, sysexLenBytes] = readVlq(view, offset);
        offset += sysexLenBytes + sysexLen;
      } else if (statusHigh >= 0x80 && statusHigh <= 0xE0) {
        // Regular MIDI event
        const data1 = view.getUint8(offset++);
        const hasTwoBytes = statusHigh !== 0xC0 && statusHigh !== 0xD0;
        const data2 = hasTwoBytes ? view.getUint8(offset++) : 0;
        events.push({ tick: absoluteTick, status, data1, data2 });
      } else {
        // Unknown – skip one byte
        offset++;
      }
    }

    return { track: { name: trackName, events }, microsecondsPerBeat };
  }

  /**
   * Convert a parsed MIDI track to NAW `NoteEvent[]`.
   *
   * @param track              - Parsed MIDI track
   * @param ticksPerBeat       - Ticks per quarter note (PPQN)
   * @param bpm                - Project BPM (for mapping ticks → steps)
   * @param stepsPerBeat       - NAW grid resolution (default 4 = 16th notes)
   */
  static toNoteEvents(
    track: MidiFileTrack,
    ticksPerBeat: number,
    bpm: number,
    stepsPerBeat = 4,
  ): NoteEvent[] {
    const noteOnMap = new Map<number, { tick: number; velocity: number }>();
    const noteEvents: NoteEvent[] = [];

    const ticksToSteps = (ticks: number) =>
      Math.round((ticks / ticksPerBeat) * stepsPerBeat);

    for (const ev of track.events) {
      const statusHigh = ev.status & 0xF0;
      const isNoteOn  = statusHigh === 0x90 && ev.data2 > 0;
      const isNoteOff = statusHigh === 0x80 || (statusHigh === 0x90 && ev.data2 === 0);

      if (isNoteOn) {
        noteOnMap.set(ev.data1, { tick: ev.tick, velocity: ev.data2 });
      } else if (isNoteOff) {
        const noteOn = noteOnMap.get(ev.data1);
        if (noteOn) {
          const step     = ticksToSteps(noteOn.tick);
          const duration = Math.max(1, ticksToSteps(ev.tick - noteOn.tick));
          noteEvents.push({
            step,
            note: ev.data1,
            duration,
            velocity: noteOn.velocity / 127,
          });
          noteOnMap.delete(ev.data1);
        }
      }
    }

    // Close any hanging notes
    for (const [note, noteOn] of noteOnMap) {
      const step = ticksToSteps(noteOn.tick);
      noteEvents.push({ step, note, duration: stepsPerBeat, velocity: noteOn.velocity / 127 });
    }

    // Sort by step
    noteEvents.sort((a, b) => a.step - b.step);
    return noteEvents;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * MidiFileWriter
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Writes a Standard MIDI File from NAW `NoteEvent[]`.
 *
 * @example
 * ```typescript
 * const buffer = MidiFileWriter.write(noteEvents, { bpm: 128, ppqn: 480 });
 * const blob = new Blob([buffer], { type: 'audio/midi' });
 * ```
 */
export class MidiFileWriter {
  /**
   * Serialize note events to a MIDI Format-0 file.
   *
   * @param events     - Note events to encode
   * @param options    - BPM, PPQN, MIDI channel (0-based)
   * @returns `ArrayBuffer` containing the .mid file data
   */
  static write(
    events: NoteEvent[],
    options: { bpm?: number; ppqn?: number; channel?: number } = {},
  ): ArrayBuffer {
    const bpm    = options.bpm    ?? 120;
    const ppqn   = options.ppqn   ?? 480;
    const ch     = (options.channel ?? 0) & 0x0F;
    const uspb   = Math.round(60_000_000 / bpm); // µs per beat

    // Sort events by step
    const sorted = [...events].sort((a, b) => a.step - b.step);

    // Build raw track bytes
    const raw: number[] = [];

    // Tempo meta event at tick 0
    raw.push(0x00, 0xFF, 0x51, 0x03,
      (uspb >> 16) & 0xFF, (uspb >> 8) & 0xFF, uspb & 0xFF);

    // Convert NoteEvents → note-on / note-off pairs
    type MidiRawEvent = { tick: number; bytes: number[] };
    const midiEvents: MidiRawEvent[] = [];

    const stepsPerBeat = 4; // 16th-note grid
    const ticksPerStep = ppqn / stepsPerBeat;

    for (const ev of sorted) {
      const note       = typeof ev.note === 'string' ? 60 : ev.note; // fallback to middle C
      const velocity   = Math.round(Math.max(0, Math.min(1, ev.velocity)) * 127);
      const startTick  = Math.round(ev.step * ticksPerStep);
      const endTick    = startTick + Math.round(ev.duration * ticksPerStep);

      midiEvents.push({
        tick: startTick,
        bytes: [0x90 | ch, note & 0x7F, velocity],
      });
      midiEvents.push({
        tick: endTick,
        bytes: [0x80 | ch, note & 0x7F, 0],
      });
    }

    // Sort by tick
    midiEvents.sort((a, b) => a.tick - b.tick);

    // Write with delta times
    let lastTick = 0;
    for (const ev of midiEvents) {
      const delta = ev.tick - lastTick;
      raw.push(...encodeVlq(delta), ...ev.bytes);
      lastTick = ev.tick;
    }

    // End of track meta event
    raw.push(0x00, 0xFF, 0x2F, 0x00);

    // Assemble SMF
    const trackLen = raw.length;
    const buf      = new ArrayBuffer(14 + 8 + trackLen);
    const view     = new DataView(buf);
    let off = 0;

    // MThd header
    view.setUint32(off, 0x4D546864, false); off += 4; // "MThd"
    view.setUint32(off, 6, false);           off += 4; // length = 6
    view.setUint16(off, 0, false);           off += 2; // format 0
    view.setUint16(off, 1, false);           off += 2; // 1 track
    view.setUint16(off, ppqn, false);        off += 2; // PPQN

    // MTrk chunk
    view.setUint32(off, 0x4D54726B, false);  off += 4; // "MTrk"
    view.setUint32(off, trackLen, false);    off += 4;
    for (const byte of raw) {
      view.setUint8(off++, byte);
    }

    return buf;
  }
}
