/**
 * Waveform Render Worker
 *
 * Phase 1 Implementation – Multi-threading
 *
 * Runs inside a Web Worker (background thread) so that CPU-intensive waveform
 * peak extraction never blocks the UI thread or causes playback grid stutters.
 *
 * Responsibilities:
 *   • Decode raw PCM Float32 data into peak / RMS arrays for waveform rendering
 *   • Downsample audio to a display-friendly resolution (pixels-per-block)
 *   • Report progress back to the main thread for loading spinners
 *
 * Message protocol (main → worker):
 *   `{ type: 'render', id, samples: Float32Array, channelCount, sampleRate,
 *       pixelsWide, pixelRatio? }`
 *
 * Message protocol (worker → main):
 *   `{ type: 'progress', id, progress: 0–1 }`
 *   `{ type: 'result',   id, peaks: Float32Array, rms: Float32Array,
 *       pixelsWide, durationSeconds }`
 *   `{ type: 'error',    id, message }`
 *
 * @see services/audio/WaveformWorkerBridge.ts  (main-thread wrapper)
 * @see ROADMAP.md § Phase 1.3
 */

/**
 * Compute peak and RMS envelope arrays from a mono Float32 PCM buffer.
 *
 * @param samples      - PCM data (single channel, interleaved if multi-channel)
 * @param channelCount - Number of interleaved channels (used for stride)
 * @param pixelsWide   - Number of blocks in the output envelope
 * @returns `{ peaks, rms }` – two Float32Arrays of length `pixelsWide`
 */
function computeEnvelope(
  samples: Float32Array,
  channelCount: number,
  pixelsWide: number,
): { peaks: Float32Array; rms: Float32Array } {
  const totalFrames = Math.floor(samples.length / channelCount);
  const framesPerBlock = Math.max(1, Math.floor(totalFrames / pixelsWide));

  const peaks = new Float32Array(pixelsWide);
  const rms   = new Float32Array(pixelsWide);

  for (let b = 0; b < pixelsWide; b++) {
    const start = b * framesPerBlock;
    const end   = Math.min(start + framesPerBlock, totalFrames);
    let peakVal = 0;
    let sumSq   = 0;
    let count   = 0;

    for (let f = start; f < end; f++) {
      // Average across channels for the peak display
      let frameSum = 0;
      for (let c = 0; c < channelCount; c++) {
        frameSum += samples[f * channelCount + c];
      }
      const mono = frameSum / channelCount;
      const abs  = Math.abs(mono);
      if (abs > peakVal) peakVal = abs;
      sumSq += mono * mono;
      count++;
    }

    peaks[b] = peakVal;
    rms[b]   = count > 0 ? Math.sqrt(sumSq / count) : 0;
  }

  return { peaks, rms };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Worker message handler
 * ──────────────────────────────────────────────────────────────────────── */

/** Worker-global self reference (typed for Web Worker context). */
declare const self: Worker;

if (typeof self !== 'undefined' && typeof globalThis !== 'undefined' && 'WorkerGlobalScope' in globalThis) {
  self.onmessage = (ev: MessageEvent) => {
    const msg = ev.data as {
      type: string;
      id: string;
      samples: Float32Array;
      channelCount: number;
      sampleRate: number;
      pixelsWide: number;
    };

    if (msg.type !== 'render') return;

    const { id, samples, channelCount, sampleRate, pixelsWide } = msg;

    try {
      // Report start
      self.postMessage({ type: 'progress', id, progress: 0 });

      const { peaks, rms } = computeEnvelope(samples, channelCount, pixelsWide);

      // Report completion
      self.postMessage({ type: 'progress', id, progress: 1 });

      const durationSeconds = samples.length / channelCount / sampleRate;

      // Transfer ownership of typed arrays to avoid copying (zero-copy transfer)
      self.postMessage(
        { type: 'result', id, peaks, rms, pixelsWide, durationSeconds },
        { transfer: [peaks.buffer, rms.buffer] },
      );
    } catch (err) {
      self.postMessage({
        type: 'error',
        id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Exports for test / direct import
 * ──────────────────────────────────────────────────────────────────────── */
export { computeEnvelope };
