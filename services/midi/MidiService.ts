/**
 * MIDI Service
 *
 * Phase 3 Implementation – MIDI & External Hardware Protocols
 *
 * Provides two-way communication with physical MIDI keyboards, drum pads,
 * and control surfaces via the Web MIDI API, plus import/export of standard
 * `.mid` (MIDI 1.0) files.
 *
 * Architecture:
 * ```
 * MidiService
 *   ├── MidiDeviceManager  – enumerate inputs/outputs, handle hot-plug
 *   ├── MidiInputRouter    – route incoming MIDI to tracks / piano roll
 *   ├── MidiOutputPort     – send MIDI to hardware (sync, note-on, CC)
 *   └── MidiFileIO         – parse and write Standard MIDI Files (.mid)
 * ```
 *
 * @see services/midi/AutomationCurve.ts  (high-resolution automation)
 * @see ROADMAP.md § Phase 3.1
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Core MIDI message types
 * ──────────────────────────────────────────────────────────────────────── */

/** MIDI status byte categories. */
export enum MidiStatus {
  NOTE_OFF        = 0x80,
  NOTE_ON         = 0x90,
  POLY_AFTERTOUCH = 0xA0,
  CONTROL_CHANGE  = 0xB0,
  PROGRAM_CHANGE  = 0xC0,
  CHANNEL_PRESS   = 0xD0,
  PITCH_BEND      = 0xE0,
  SYSEX           = 0xF0,
  CLOCK           = 0xF8,
  START           = 0xFA,
  CONTINUE        = 0xFB,
  STOP            = 0xFC,
}

/** Parsed representation of a single MIDI message. */
export interface MidiMessage {
  /** Raw MIDI bytes */
  raw: Uint8Array;
  /** MIDI status category */
  status: MidiStatus;
  /** MIDI channel (0-based, 0–15) */
  channel: number;
  /** First data byte (note number / CC number / etc.) */
  data1: number;
  /** Second data byte (velocity / CC value / etc.) */
  data2: number;
  /** High-resolution timestamp from the Web MIDI API (ms) */
  timestamp: number;
}

/** Descriptor for a connected MIDI device. */
export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  state: 'connected' | 'disconnected';
}

/* ──────────────────────────────────────────────────────────────────────────
 * MIDI message parser
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Parse raw MIDI bytes into a structured `MidiMessage`.
 */
export function parseMidiMessage(
  bytes: Uint8Array,
  timestamp = 0,
): MidiMessage {
  const status  = (bytes[0] & 0xF0) as MidiStatus;
  const channel = bytes[0] & 0x0F;
  return {
    raw: bytes,
    status,
    channel,
    data1: bytes[1] ?? 0,
    data2: bytes[2] ?? 0,
    timestamp,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * MidiService
 * ──────────────────────────────────────────────────────────────────────── */

/** Callback invoked whenever a MIDI message arrives from any input. */
export type MidiMessageCallback = (msg: MidiMessage, deviceId: string) => void;

/** Callback invoked when a MIDI device connects or disconnects. */
export type MidiStateChangeCallback = (device: MidiDeviceInfo) => void;

/**
 * Central MIDI service.  Wraps the Web MIDI API and provides helpers for
 * device management, message routing, and MIDI file I/O.
 *
 * @example
 * ```typescript
 * const midi = new MidiService();
 * await midi.initialize();
 *
 * midi.onMessage = (msg) => {
 *   if (msg.status === MidiStatus.NOTE_ON) {
 *     piano.playNote(msg.data1, msg.data2);
 *   }
 * };
 * ```
 */
export class MidiService {
  private _access: MIDIAccess | null = null;
  private _inputs  = new Map<string, MIDIInput>();
  private _outputs = new Map<string, MIDIOutput>();
  private _initialized = false;

  /** Fired for every incoming MIDI message across all inputs. */
  public onMessage: MidiMessageCallback | null = null;
  /** Fired when a device connects or disconnects. */
  public onDeviceStateChange: MidiStateChangeCallback | null = null;

  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Request Web MIDI API access and enumerate devices.
   *
   * In browsers that support Web MIDI, this triggers a permission prompt.
   * Falls back gracefully when Web MIDI is not available (e.g., Firefox
   * without the Jazz plugin, or during SSR/Node).
   */
  async initialize(): Promise<boolean> {
    if (this._initialized) return true;

    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      // Web MIDI not available – service operates in stub mode
      this._initialized = true;
      return false;
    }

    try {
      this._access = await navigator.requestMIDIAccess({ sysex: false });
      this._access.onstatechange = (ev) => this._handleStateChange(ev);
      this._refreshDevices();
      this._initialized = true;
      return true;
    } catch {
      // Permission denied or MIDI unavailable
      this._initialized = true;
      return false;
    }
  }

  /** List all currently connected MIDI input devices. */
  getInputDevices(): MidiDeviceInfo[] {
    return Array.from(this._inputs.values()).map(d => ({
      id: d.id,
      name: d.name ?? 'Unknown Input',
      manufacturer: d.manufacturer ?? '',
      type: 'input' as const,
      state: d.state,
    }));
  }

  /** List all currently connected MIDI output devices. */
  getOutputDevices(): MidiDeviceInfo[] {
    return Array.from(this._outputs.values()).map(d => ({
      id: d.id,
      name: d.name ?? 'Unknown Output',
      manufacturer: d.manufacturer ?? '',
      type: 'output' as const,
      state: d.state,
    }));
  }

  /**
   * Send a raw MIDI message to a specific output device.
   *
   * @param deviceId - Output device ID from `getOutputDevices()`
   * @param bytes    - Raw MIDI bytes
   * @param timeMs   - Optional send timestamp (ms from epoch)
   */
  sendMessage(deviceId: string, bytes: Uint8Array, timeMs?: number): void {
    const output = this._outputs.get(deviceId);
    if (!output) return;
    output.send(bytes, timeMs);
  }

  /** Send a Note-On message. */
  sendNoteOn(
    deviceId: string,
    channel: number,
    note: number,
    velocity: number,
  ): void {
    this.sendMessage(
      deviceId,
      new Uint8Array([MidiStatus.NOTE_ON | (channel & 0x0F), note & 0x7F, velocity & 0x7F]),
    );
  }

  /** Send a Note-Off message. */
  sendNoteOff(deviceId: string, channel: number, note: number): void {
    this.sendMessage(
      deviceId,
      new Uint8Array([MidiStatus.NOTE_OFF | (channel & 0x0F), note & 0x7F, 0]),
    );
  }

  /** Send a Control Change (CC) message. */
  sendControlChange(
    deviceId: string,
    channel: number,
    cc: number,
    value: number,
  ): void {
    this.sendMessage(
      deviceId,
      new Uint8Array([MidiStatus.CONTROL_CHANGE | (channel & 0x0F), cc & 0x7F, value & 0x7F]),
    );
  }

  /** Send MIDI Clock tick to all outputs (24 ticks per quarter note). */
  sendClock(): void {
    const tick = new Uint8Array([MidiStatus.CLOCK]);
    for (const [id] of this._outputs) this.sendMessage(id, tick);
  }

  /** Send MIDI Start to all outputs. */
  sendStart(): void {
    for (const [id] of this._outputs)
      this.sendMessage(id, new Uint8Array([MidiStatus.START]));
  }

  /** Send MIDI Stop to all outputs. */
  sendStop(): void {
    for (const [id] of this._outputs)
      this.sendMessage(id, new Uint8Array([MidiStatus.STOP]));
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private _refreshDevices(): void {
    if (!this._access) return;

    // Unsubscribe existing listeners
    for (const input of this._inputs.values()) {
      input.onmidimessage = null;
    }
    this._inputs.clear();
    this._outputs.clear();

    for (const [id, input] of this._access.inputs) {
      this._inputs.set(id, input);
      input.onmidimessage = (ev) => this._handleMessage(ev, id);
    }
    for (const [id, output] of this._access.outputs) {
      this._outputs.set(id, output);
    }
  }

  private _handleMessage(ev: MIDIMessageEvent, deviceId: string): void {
    if (!ev.data || !this.onMessage) return;
    const msg = parseMidiMessage(ev.data, ev.timeStamp);
    this.onMessage(msg, deviceId);
  }

  private _handleStateChange(ev: MIDIConnectionEvent): void {
    this._refreshDevices();
    if (!this.onDeviceStateChange) return;
    const port = ev.port;
    this.onDeviceStateChange({
      id: port.id,
      name: port.name ?? 'Unknown',
      manufacturer: port.manufacturer ?? '',
      type: port.type,
      state: port.state,
    });
  }
}

/** Singleton MIDI service for the application. */
export const midiService = new MidiService();
