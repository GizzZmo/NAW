interface PendingMidiNote {
  eventId: string;
  trackId: string;
  startAbsoluteStep: number;
}

export interface CompletedMidiNote {
  eventId: string;
  trackId: string;
  duration: number;
}

/** Pairs MIDI Note On/Off messages so recorded note lengths reflect key holds. */
export class MidiRecordingBuffer {
  private readonly pending = new Map<string, PendingMidiNote>();

  private key(deviceId: string, channel: number, note: number): string {
    return `${deviceId}:${channel}:${note}`;
  }

  begin(
    deviceId: string,
    channel: number,
    note: number,
    pendingNote: PendingMidiNote,
  ): void {
    this.pending.set(this.key(deviceId, channel, note), pendingNote);
  }

  finish(
    deviceId: string,
    channel: number,
    note: number,
    endAbsoluteStep: number,
  ): CompletedMidiNote | null {
    const key = this.key(deviceId, channel, note);
    const started = this.pending.get(key);
    if (!started) return null;

    this.pending.delete(key);
    return {
      eventId: started.eventId,
      trackId: started.trackId,
      duration: Math.max(1, Math.round(endAbsoluteStep - started.startAbsoluteStep)),
    };
  }

  clear(): void {
    this.pending.clear();
  }

  get size(): number {
    return this.pending.size;
  }
}
