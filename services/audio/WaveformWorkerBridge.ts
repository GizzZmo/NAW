/**
 * WaveformWorkerBridge
 *
 * Phase 1 Implementation – Multi-threading (main-thread side)
 *
 * Provides a Promise-based API for requesting waveform peak/RMS data from the
 * background `WaveformWorker` thread.  Handles worker lifecycle, pending-job
 * tracking, and transferable ArrayBuffer ownership.
 *
 * @example
 * ```typescript
 * const bridge = new WaveformWorkerBridge();
 *
 * const { peaks, rms } = await bridge.render({
 *   samples: audioBuffer.getChannelData(0),
 *   channelCount: 1,
 *   sampleRate: 44100,
 *   pixelsWide: 800,
 * });
 * ```
 *
 * @see services/audio/workers/WaveformWorker.ts
 * @see ROADMAP.md § Phase 1.3
 */

/** Input parameters for a waveform render request. */
export interface WaveformRenderRequest {
  /** Raw PCM data (interleaved if multi-channel). */
  samples: Float32Array;
  /** Number of audio channels (1 = mono, 2 = stereo). */
  channelCount: number;
  /** Sample rate in Hz. */
  sampleRate: number;
  /** Desired envelope width in pixels (columns). */
  pixelsWide: number;
}

/** Output data from a completed waveform render job. */
export interface WaveformRenderResult {
  /** Peak amplitude per pixel column (0–1). */
  peaks: Float32Array;
  /** RMS amplitude per pixel column (0–1). */
  rms: Float32Array;
  /** Total audio duration in seconds. */
  durationSeconds: number;
  /** Pixel width matching the request. */
  pixelsWide: number;
}

/** Optional progress callback (0–1). */
export type WaveformProgressCallback = (progress: number) => void;

/* ──────────────────────────────────────────────────────────────────────────
 * WaveformWorkerBridge
 * ──────────────────────────────────────────────────────────────────────── */

/** Counter for unique job IDs. */
let _jobCounter = 0;

/**
 * Main-thread bridge to the WaveformWorker background thread.
 *
 * A single worker is kept alive for the lifetime of the bridge.  Call
 * `dispose()` when the bridge is no longer needed (e.g., on component unmount).
 */
export class WaveformWorkerBridge {
  private _worker: Worker | null = null;
  private readonly _pending = new Map<
    string,
    {
      resolve: (result: WaveformRenderResult) => void;
      reject: (err: Error) => void;
      onProgress?: WaveformProgressCallback;
    }
  >();

  constructor(workerUrl = '/workers/WaveformWorker.js') {
    if (typeof Worker !== 'undefined') {
      this._worker = new Worker(workerUrl, { type: 'module' });
      this._worker.onmessage = (ev: MessageEvent) => this._handleMessage(ev);
      this._worker.onerror = (ev: ErrorEvent) => this._handleError(ev);
    }
  }

  /**
   * Request a waveform envelope from the background worker.
   *
   * The `samples` buffer is **transferred** to the worker (zero-copy).
   * Do not read from `samples` after calling this method.
   *
   * @param request    - Render parameters
   * @param onProgress - Optional progress callback (0–1)
   * @returns Promise resolving to peak and RMS envelope arrays
   */
  render(
    request: WaveformRenderRequest,
    onProgress?: WaveformProgressCallback,
  ): Promise<WaveformRenderResult> {
    return new Promise((resolve, reject) => {
      const id = `wf_${++_jobCounter}`;
      this._pending.set(id, { resolve, reject, onProgress });

      if (!this._worker) {
        // Fallback: compute synchronously on the main thread (e.g., SSR / Node)
        try {
          const { computeEnvelope } = require('./workers/WaveformWorker');
          const { peaks, rms } = computeEnvelope(
            request.samples,
            request.channelCount,
            request.pixelsWide,
          );
          const durationSeconds =
            request.samples.length / request.channelCount / request.sampleRate;
          resolve({ peaks, rms, durationSeconds, pixelsWide: request.pixelsWide });
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
        this._pending.delete(id);
        return;
      }

      // Transfer the sample buffer to avoid copying
      this._worker.postMessage(
        {
          type: 'render',
          id,
          samples: request.samples,
          channelCount: request.channelCount,
          sampleRate: request.sampleRate,
          pixelsWide: request.pixelsWide,
        },
        { transfer: [request.samples.buffer] },
      );
    });
  }

  /** Terminate the worker and reject all pending jobs. */
  dispose(): void {
    this._worker?.terminate();
    this._worker = null;
    for (const [id, pending] of this._pending) {
      pending.reject(new Error('WaveformWorkerBridge disposed'));
      this._pending.delete(id);
    }
  }

  private _handleMessage(ev: MessageEvent): void {
    const data = ev.data as {
      type: string;
      id: string;
      progress?: number;
      peaks?: Float32Array;
      rms?: Float32Array;
      pixelsWide?: number;
      durationSeconds?: number;
      message?: string;
    };

    const pending = this._pending.get(data.id);
    if (!pending) return;

    if (data.type === 'progress') {
      pending.onProgress?.(data.progress ?? 0);
    } else if (data.type === 'result') {
      pending.resolve({
        peaks: data.peaks!,
        rms: data.rms!,
        pixelsWide: data.pixelsWide!,
        durationSeconds: data.durationSeconds!,
      });
      this._pending.delete(data.id);
    } else if (data.type === 'error') {
      pending.reject(new Error(data.message ?? 'WaveformWorker error'));
      this._pending.delete(data.id);
    }
  }

  private _handleError(ev: ErrorEvent): void {
    // Reject all pending jobs on a fatal worker error
    for (const [id, pending] of this._pending) {
      pending.reject(new Error(`WaveformWorker fatal error: ${ev.message}`));
      this._pending.delete(id);
    }
  }
}

/** Singleton bridge for application-wide use. */
export const waveformWorkerBridge = new WaveformWorkerBridge();
