/**
 * AudioWorklet Engine
 *
 * Phase 1 Implementation – Core Engine & Scheduling
 *
 * Wraps the browser's AudioWorklet API so that all DSP work runs in a
 * dedicated real-time thread rather than on the main JavaScript thread.
 * Also implements a **look-ahead scheduler** for sample-accurate event
 * delivery: events are queued several milliseconds before they occur,
 * decoupling audio timing from the inherently jittery JS event loop.
 */

export interface ScheduledEvent {
  time: number;
  callback: () => void;
}

export interface MeterReading {
  rmsL: number;
  rmsR: number;
  peakL: number;
  peakR: number;
  capturedAt: number;
}

export interface AudioWorkletEngineConfig {
  lookAheadMs: number;
  schedulerIntervalMs: number;
  sampleRate: number;
  workletUrl: string;
}

export const DEFAULT_WORKLET_ENGINE_CONFIG: AudioWorkletEngineConfig = {
  lookAheadMs: 25,
  schedulerIntervalMs: 12,
  sampleRate: 44100,
  workletUrl: '/worklets/DspProcessor.js',
};

export class LookAheadScheduler {
  private readonly queue: ScheduledEvent[] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private getAudioTime: () => number;
  private readonly lookAheadMs: number;
  private readonly intervalMs: number;

  constructor(getAudioTime: () => number, lookAheadMs = 25, intervalMs = 12) {
    this.getAudioTime = getAudioTime;
    this.lookAheadMs = lookAheadMs;
    this.intervalMs = intervalMs;
  }

  schedule(event: ScheduledEvent): void {
    if (!Number.isFinite(event.time) || event.time < 0) {
      throw new RangeError('Scheduled event time must be a finite non-negative number.');
    }
    if (typeof event.callback !== 'function') {
      throw new TypeError('Scheduled event callback must be a function.');
    }
    let i = this.queue.length;
    while (i > 0 && this.queue[i - 1].time > event.time) i--;
    this.queue.splice(i, 0, event);
  }

  clearAll(): void { this.queue.length = 0; }
  cancel(predicate: (e: ScheduledEvent) => boolean): void {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (predicate(this.queue[i])) this.queue.splice(i, 1);
    }
  }
  start(): void {
    if (this.timerId !== null) return;
    this.timerId = setInterval(() => this._tick(), this.intervalMs);
  }
  stop(): void {
    if (this.timerId === null) return;
    clearInterval(this.timerId);
    this.timerId = null;
  }
  get pendingCount(): number { return this.queue.length; }
  private _tick(): void { this._dispatchDue(); }
  _dispatchDue(): void {
    const now = this.getAudioTime();
    const horizon = now + this.lookAheadMs / 1000;
    while (this.queue.length > 0 && this.queue[0].time <= horizon) {
      const event = this.queue.shift()!;
      try { event.callback(); } catch (err) {
        console.error('[LookAheadScheduler] event callback threw:', err);
      }
    }
  }
}

export class AudioWorkletEngine {
  private config: AudioWorkletEngineConfig;
  private _audioContext: AudioContext | null = null;
  private _workletNode: AudioWorkletNode | null = null;
  private _scheduler: LookAheadScheduler | null = null;
  private _initialized = false;
  public onMeterUpdate: ((reading: MeterReading) => void) | null = null;

  constructor(config: Partial<AudioWorkletEngineConfig> = {}) {
    this.config = { ...DEFAULT_WORKLET_ENGINE_CONFIG, ...config };
  }
  get audioContext(): AudioContext | null { return this._audioContext; }
  get workletNode(): AudioWorkletNode | null { return this._workletNode; }
  get scheduler(): LookAheadScheduler | null { return this._scheduler; }
  get initialized(): boolean { return this._initialized; }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (typeof AudioContext === 'undefined' || typeof AudioWorkletNode === 'undefined') {
      throw new Error('This browser does not support the Web Audio API required by NAW.');
    }
    try {
      this._audioContext = new AudioContext({ sampleRate: this.config.sampleRate });
      await this._audioContext.audioWorklet.addModule(this.config.workletUrl);
      this._workletNode = new AudioWorkletNode(
        this._audioContext, 'naw-dsp-processor',
        { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] },
      );
      this._workletNode.port.onmessage = (ev: MessageEvent) => {
        if (ev.data?.type === 'meters' && this.onMeterUpdate) {
          this.onMeterUpdate({
            rmsL: ev.data.rmsL, rmsR: ev.data.rmsR,
            peakL: ev.data.peakL, peakR: ev.data.peakR,
            capturedAt: this._audioContext!.currentTime,
          });
        }
      };
      this._workletNode.connect(this._audioContext.destination);
      this._scheduler = new LookAheadScheduler(
        () => this._audioContext!.currentTime,
        this.config.lookAheadMs,
        this.config.schedulerIntervalMs,
      );
      this._scheduler.start();
      this._initialized = true;
    } catch (error) {
      this._scheduler?.stop();
      this._scheduler?.clearAll();
      this._workletNode?.disconnect();
      this._workletNode = null;
      const context = this._audioContext;
      this._audioContext = null;
      this._scheduler = null;
      if (context && context.state !== 'closed') {
        await context.close().catch(() => undefined);
      }
      this._initialized = false;
      throw error;
    }
  }

  scheduleEvent(event: ScheduledEvent): void { this._scheduler?.schedule(event); }
  scheduleBeatSequence(startTime: number, stepSecs: number, steps: number, callback: (time: number, step: number) => void): void {
    for (let i = 0; i < steps; i++) {
      const t = startTime + i * stepSecs;
      this.scheduleEvent({ time: t, callback: () => callback(t, i) });
    }
  }
  sendDspMessage(message: Record<string, unknown>): void { this._workletNode?.port.postMessage(message); }
  setGain(gainLinear: number): void {
    const param = this._workletNode?.parameters.get('gain');
    if (param) param.value = Math.max(0, Math.min(2, gainLinear));
  }
  setPan(pan: number): void {
    const param = this._workletNode?.parameters.get('pan');
    if (param) param.value = Math.max(-1, Math.min(1, pan));
  }
  setMuted(muted: boolean): void { this.sendDspMessage({ type: 'setMuted', muted }); }
  async suspend(): Promise<void> { await this._audioContext?.suspend(); this._scheduler?.stop(); }
  async resume(): Promise<void> { await this._audioContext?.resume(); this._scheduler?.start(); }
  async dispose(): Promise<void> {
    this._scheduler?.stop();
    this._scheduler?.clearAll();
    this._workletNode?.disconnect();
    await this._audioContext?.close();
    this._audioContext = null;
    this._workletNode = null;
    this._scheduler = null;
    this._initialized = false;
  }
}

export const audioWorkletEngine = new AudioWorkletEngine();
