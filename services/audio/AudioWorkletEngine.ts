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
 *
 * Architecture:
 * ```
 * AudioWorkletEngine
 *   ├── AudioContext (master clock + Web Audio graph)
 *   ├── AudioWorkletNode  ← NawDspProcessor runs here (DSP thread)
 *   ├── LookAheadScheduler ← schedules events ahead of time
 *   └── WorkletMeterBridge ← receives RMS/peak from DSP thread via MessagePort
 * ```
 *
 * @see services/audio/worklets/DspProcessor.ts
 * @see https://webaudio.github.io/web-audio-api/#AudioWorklet
 * @see ROADMAP.md § Phase 1.1
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────────── */

/** A scheduled audio event – fired at a precise AudioContext time. */
export interface ScheduledEvent {
  /** Absolute AudioContext time (seconds) when the event fires */
  time: number;
  /** Application-level callback to execute */
  callback: () => void;
}

/** Stereo RMS / peak levels received from the DSP thread. */
export interface MeterReading {
  rmsL: number;
  rmsR: number;
  peakL: number;
  peakR: number;
  /** AudioContext timestamp when reading was captured */
  capturedAt: number;
}

/** Configuration for AudioWorkletEngine. */
export interface AudioWorkletEngineConfig {
  /** How far ahead (ms) to schedule events. Default: 25 ms. */
  lookAheadMs: number;
  /** How often (ms) the scheduler wakes up. Default: 12 ms. */
  schedulerIntervalMs: number;
  /** Sample rate passed to AudioContext. Default: 44100. */
  sampleRate: number;
  /**
   * URL of the compiled AudioWorklet module.
   * Defaults to `/worklets/DspProcessor.js` (Vite output path).
   */
  workletUrl: string;
}

/** Default engine configuration. */
export const DEFAULT_WORKLET_ENGINE_CONFIG: AudioWorkletEngineConfig = {
  lookAheadMs: 25,
  schedulerIntervalMs: 12,
  sampleRate: 44100,
  workletUrl: '/worklets/DspProcessor.js',
};

/* ──────────────────────────────────────────────────────────────────────────
 * LookAheadScheduler
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Deterministic look-ahead scheduler.
 *
 * Inspired by Chris Wilson's "A Tale of Two Clocks" technique.
 * A `setInterval` timer wakes up every `schedulerIntervalMs` and dispatches
 * any `ScheduledEvent` whose `.time` falls within the look-ahead window.
 *
 * Because the AudioContext hardware clock is used as the reference (not
 * `Date.now()` or `performance.now()` which drift), events land on the
 * exact sample boundary requested.
 */
export class LookAheadScheduler {
  private readonly queue: ScheduledEvent[] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private getAudioTime: () => number;
  private readonly lookAheadMs: number;
  private readonly intervalMs: number;

  constructor(
    getAudioTime: () => number,
    lookAheadMs = 25,
    intervalMs = 12,
  ) {
    this.getAudioTime = getAudioTime;
    this.lookAheadMs = lookAheadMs;
    this.intervalMs = intervalMs;
  }

  /** Add an event to the queue. Events may be added in any order. */
  schedule(event: ScheduledEvent): void {
    // Insert in ascending time order for O(1) dispatch
    let i = this.queue.length;
    while (i > 0 && this.queue[i - 1].time > event.time) i--;
    this.queue.splice(i, 0, event);
  }

  /** Remove all pending events. */
  clearAll(): void {
    this.queue.length = 0;
  }

  /** Remove events matching a predicate. */
  cancel(predicate: (e: ScheduledEvent) => boolean): void {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (predicate(this.queue[i])) this.queue.splice(i, 1);
    }
  }

  /** Start the scheduler tick loop. */
  start(): void {
    if (this.timerId !== null) return;
    this.timerId = setInterval(() => this._tick(), this.intervalMs);
  }

  /** Stop the scheduler tick loop. */
  stop(): void {
    if (this.timerId === null) return;
    clearInterval(this.timerId);
    this.timerId = null;
  }

  /** Returns the number of pending events. */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Internal: dispatch events in the look-ahead window. */
  private _tick(): void {
    this._dispatchDue();
  }

  /** @internal – exposed for testing; dispatches events due within the look-ahead window. */
  _dispatchDue(): void {
    const now      = this.getAudioTime();
    const horizon  = now + this.lookAheadMs / 1000;

    while (this.queue.length > 0 && this.queue[0].time <= horizon) {
      const event = this.queue.shift()!;
      try {
        event.callback();
      } catch (err) {
        console.error('[LookAheadScheduler] event callback threw:', err);
      }
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * AudioWorkletEngine
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Manages the browser AudioContext, an AudioWorkletNode running the
 * NawDspProcessor, and the look-ahead event scheduler.
 *
 * @example
 * ```typescript
 * const engine = new AudioWorkletEngine();
 * await engine.initialize();
 *
 * // Schedule a note-on 500 ms from now, sample-accurately
 * const triggerTime = engine.audioContext!.currentTime + 0.5;
 * engine.scheduleEvent({ time: triggerTime, callback: () => playNote('C4') });
 *
 * // Listen for real-time level meters from DSP thread
 * engine.onMeterUpdate = (m) => updateMeterUI(m);
 * ```
 */
export class AudioWorkletEngine {
  private config: AudioWorkletEngineConfig;
  private _audioContext: AudioContext | null = null;
  private _workletNode: AudioWorkletNode | null = null;
  private _scheduler: LookAheadScheduler | null = null;
  private _initialized = false;

  /** Called each time the DSP thread posts new meter data (~30 fps). */
  public onMeterUpdate: ((reading: MeterReading) => void) | null = null;

  constructor(config: Partial<AudioWorkletEngineConfig> = {}) {
    this.config = { ...DEFAULT_WORKLET_ENGINE_CONFIG, ...config };
  }

  /** The underlying AudioContext (available after `initialize()`). */
  get audioContext(): AudioContext | null {
    return this._audioContext;
  }

  /** The AudioWorkletNode running the DSP processor. */
  get workletNode(): AudioWorkletNode | null {
    return this._workletNode;
  }

  /** The look-ahead scheduler. */
  get scheduler(): LookAheadScheduler | null {
    return this._scheduler;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Initialize the AudioContext and load the AudioWorklet module.
   *
   * Must be called from a user gesture handler (click / keydown) to comply
   * with browser autoplay policies.
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    // Create AudioContext
    this._audioContext = new AudioContext({ sampleRate: this.config.sampleRate });

    // Load AudioWorklet processor module
    await this._audioContext.audioWorklet.addModule(this.config.workletUrl);

    // Instantiate the DSP worklet node (stereo I/O)
    this._workletNode = new AudioWorkletNode(
      this._audioContext,
      'naw-dsp-processor',
      { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] },
    );

    // Wire meters: DSP thread → main thread
    this._workletNode.port.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'meters' && this.onMeterUpdate) {
        this.onMeterUpdate({
          rmsL: ev.data.rmsL,
          rmsR: ev.data.rmsR,
          peakL: ev.data.peakL,
          peakR: ev.data.peakR,
          capturedAt: this._audioContext!.currentTime,
        });
      }
    };

    // Connect to master output
    this._workletNode.connect(this._audioContext.destination);

    // Boot look-ahead scheduler
    this._scheduler = new LookAheadScheduler(
      () => this._audioContext!.currentTime,
      this.config.lookAheadMs,
      this.config.schedulerIntervalMs,
    );
    this._scheduler.start();

    this._initialized = true;
  }

  /**
   * Schedule an event at a precise AudioContext time.
   *
   * @param event - `{ time: AudioContext seconds, callback }`
   */
  scheduleEvent(event: ScheduledEvent): void {
    this._scheduler?.schedule(event);
  }

  /**
   * Schedule a sequence of events at regular BPM-aligned intervals.
   *
   * @param startTime  - AudioContext time for the first event
   * @param stepSecs   - Duration of one step in seconds
   * @param steps      - Number of steps to schedule
   * @param callback   - Called with the AudioContext time of each step
   */
  scheduleBeatSequence(
    startTime: number,
    stepSecs: number,
    steps: number,
    callback: (time: number, step: number) => void,
  ): void {
    for (let i = 0; i < steps; i++) {
      const t = startTime + i * stepSecs;
      this.scheduleEvent({ time: t, callback: () => callback(t, i) });
    }
  }

  /** Send a control message to the DSP thread (fire-and-forget). */
  sendDspMessage(message: Record<string, unknown>): void {
    this._workletNode?.port.postMessage(message);
  }

  /** Set the track gain (linear, 0–2) via the AudioParam. */
  setGain(gainLinear: number): void {
    const param = this._workletNode?.parameters.get('gain');
    if (param) param.value = Math.max(0, Math.min(2, gainLinear));
  }

  /** Set the stereo pan (−1 … +1) via the AudioParam. */
  setPan(pan: number): void {
    const param = this._workletNode?.parameters.get('pan');
    if (param) param.value = Math.max(-1, Math.min(1, pan));
  }

  /** Mute or unmute via the DSP thread's message port. */
  setMuted(muted: boolean): void {
    this.sendDspMessage({ type: 'setMuted', muted });
  }

  /** Suspend the AudioContext (halts DSP thread processing). */
  async suspend(): Promise<void> {
    await this._audioContext?.suspend();
    this._scheduler?.stop();
  }

  /** Resume a previously suspended context. */
  async resume(): Promise<void> {
    await this._audioContext?.resume();
    if (!this._scheduler) return;
    this._scheduler.start();
  }

  /** Tear down the engine and release all resources. */
  async dispose(): Promise<void> {
    this._scheduler?.stop();
    this._scheduler?.clearAll();
    this._workletNode?.disconnect();
    await this._audioContext?.close();
    this._audioContext  = null;
    this._workletNode   = null;
    this._scheduler     = null;
    this._initialized   = false;
  }
}

/** Singleton instance for application-wide use. */
export const audioWorkletEngine = new AudioWorkletEngine();
