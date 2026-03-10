/**
 * Automation Curve
 *
 * Phase 3 Implementation – High-Resolution Automation
 *
 * Implements vector-based (spline) automation curves for volume, panning,
 * MIDI CC, and any other continuously-varying parameter.
 *
 * Unlike block-based (step) automation, spline curves store a sparse set of
 * control points and interpolate between them at arbitrary time resolution,
 * enabling smooth parameter sweeps down to the sample level.
 *
 * Supported interpolation modes:
 *   • LINEAR   – straight-line ramp between points
 *   • SMOOTH   – cubic Hermite (natural tangents)
 *   • HOLD     – staircase (value holds until next point)
 *   • BEZIER   – full cubic Bézier with explicit handles
 *
 * @see ROADMAP.md § Phase 3.3
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────────── */

/** Interpolation mode between two adjacent control points. */
export enum AutomationInterpolation {
  /** Straight-line ramp. */
  LINEAR  = 'LINEAR',
  /** Cubic Hermite – smooth "natural" S-curve. */
  SMOOTH  = 'SMOOTH',
  /** Value holds at previous point until the next point. */
  HOLD    = 'HOLD',
  /** Full cubic Bézier with explicit in/out handles. */
  BEZIER  = 'BEZIER',
}

/** A single control point on an automation curve. */
export interface AutomationPoint {
  /** Timeline position in beats (float, ≥ 0). */
  beat: number;
  /** Parameter value at this point. */
  value: number;
  /** Interpolation mode applied from this point to the next. */
  interpolation: AutomationInterpolation;
  /**
   * Bézier outgoing handle offset `[Δbeat, Δvalue]`.
   * Only used when `interpolation === BEZIER`.
   */
  handleOut?: [number, number];
  /**
   * Bézier incoming handle offset `[Δbeat, Δvalue]` (from previous point).
   * Only used when `interpolation === BEZIER`.
   */
  handleIn?: [number, number];
}

/** Configuration for a new `AutomationCurve`. */
export interface AutomationCurveConfig {
  /** Human-readable label (e.g. "Volume", "Filter Cutoff"). */
  label: string;
  /** Parameter unit for display (e.g. "dB", "%", "Hz"). */
  unit?: string;
  /** Minimum allowed value. */
  minValue: number;
  /** Maximum allowed value. */
  maxValue: number;
  /** Default value when no points are present. */
  defaultValue: number;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Interpolation helpers
 * ──────────────────────────────────────────────────────────────────────── */

/** Clamp `v` to [min, max]. */
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * Evaluate a cubic Hermite spline at normalized parameter `t` ∈ [0, 1].
 * `m0` and `m1` are the tangents at p0 and p1 respectively.
 */
function cubicHermite(
  p0: number, m0: number,
  p1: number, m1: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0 +
    (t3 - 2 * t2 + t)     * m0 +
    (-2 * t3 + 3 * t2)    * p1 +
    (t3 - t2)             * m1
  );
}

/**
 * Evaluate a cubic Bézier curve at parameter `t` ∈ [0, 1].
 * P0, P1 = end points; C0, C1 = control handles.
 */
function cubicBezier(
  p0: number, c0: number,
  p1: number, c1: number,
  t: number,
): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 +
         3 * mt * mt * t  * c0 +
         3 * mt * t  * t  * c1 +
         t  * t  * t       * p1;
}

/* ──────────────────────────────────────────────────────────────────────────
 * AutomationCurve
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * A vector-based automation curve.
 *
 * Stores a sorted list of control points and evaluates them at any beat
 * position using the requested interpolation mode.
 *
 * @example
 * ```typescript
 * const vol = new AutomationCurve({
 *   label: 'Volume', unit: 'dB',
 *   minValue: -96, maxValue: 0, defaultValue: 0,
 * });
 *
 * vol.addPoint({ beat: 0,  value: 0,   interpolation: AutomationInterpolation.SMOOTH });
 * vol.addPoint({ beat: 8,  value: -12, interpolation: AutomationInterpolation.SMOOTH });
 * vol.addPoint({ beat: 16, value: 0,   interpolation: AutomationInterpolation.LINEAR });
 *
 * // Evaluate at any resolution
 * for (let b = 0; b <= 16; b += 0.01) {
 *   const db = vol.evaluate(b);
 * }
 * ```
 */
export class AutomationCurve {
  public readonly config: AutomationCurveConfig;
  private _points: AutomationPoint[] = [];

  constructor(config: AutomationCurveConfig) {
    this.config = config;
  }

  /** All control points, sorted ascending by beat. */
  get points(): ReadonlyArray<AutomationPoint> {
    return this._points;
  }

  /** Add a control point. Points are automatically sorted by beat. */
  addPoint(point: AutomationPoint): void {
    // Replace existing point at same beat position
    const existing = this._points.findIndex(p => p.beat === point.beat);
    if (existing >= 0) {
      this._points[existing] = point;
    } else {
      this._points.push(point);
      this._points.sort((a, b) => a.beat - b.beat);
    }
  }

  /** Remove a control point by its beat position. */
  removePoint(beat: number): boolean {
    const idx = this._points.findIndex(p => p.beat === beat);
    if (idx < 0) return false;
    this._points.splice(idx, 1);
    return true;
  }

  /** Move an existing point to a new beat / value. */
  movePoint(
    oldBeat: number,
    newBeat: number,
    newValue: number,
  ): void {
    const idx = this._points.findIndex(p => p.beat === oldBeat);
    if (idx < 0) return;
    this._points[idx] = {
      ...this._points[idx],
      beat: newBeat,
      value: clamp(newValue, this.config.minValue, this.config.maxValue),
    };
    this._points.sort((a, b) => a.beat - b.beat);
  }

  /** Remove all control points. */
  clear(): void {
    this._points = [];
  }

  /**
   * Evaluate the curve at `beat` position.
   *
   * Returns `config.defaultValue` when there are no points.
   * Clamps to `[minValue, maxValue]`.
   */
  evaluate(beat: number): number {
    const pts = this._points;

    if (pts.length === 0) return this.config.defaultValue;
    if (beat <= pts[0].beat) return pts[0].value;
    if (beat >= pts[pts.length - 1].beat) return pts[pts.length - 1].value;

    // Find surrounding segment
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].beat <= beat) lo = mid; else hi = mid;
    }

    const p0 = pts[lo];
    const p1 = pts[hi];
    const t  = (beat - p0.beat) / (p1.beat - p0.beat);

    let result: number;

    switch (p0.interpolation) {
      case AutomationInterpolation.HOLD:
        result = p0.value;
        break;

      case AutomationInterpolation.LINEAR:
        result = p0.value + t * (p1.value - p0.value);
        break;

      case AutomationInterpolation.SMOOTH: {
        // Cubic Hermite with Catmull-Rom tangents
        const prevVal = lo > 0              ? pts[lo - 1].value : p0.value;
        const nextVal = hi < pts.length - 1 ? pts[hi + 1].value : p1.value;
        const m0 = (p1.value - prevVal) / 2;
        const m1 = (nextVal  - p0.value) / 2;
        result = cubicHermite(p0.value, m0, p1.value, m1, t);
        break;
      }

      case AutomationInterpolation.BEZIER: {
        const [, ov0] = p0.handleOut ?? [0, 0];
        const [, iv1] = p1.handleIn  ?? [0, 0];
        const c0 = p0.value + ov0;
        const c1 = p1.value + iv1;
        result = cubicBezier(p0.value, c0, p1.value, c1, t);
        break;
      }

      default:
        result = p0.value + t * (p1.value - p0.value);
    }

    return clamp(result, this.config.minValue, this.config.maxValue);
  }

  /**
   * Sample the curve at a uniform grid of `count` beats starting at `startBeat`.
   *
   * Useful for baking automation into a Float32Array before sending to the
   * audio engine (e.g., for offline rendering).
   *
   * @param startBeat - First sample beat
   * @param endBeat   - Last sample beat (exclusive)
   * @param count     - Number of samples
   */
  sample(startBeat: number, endBeat: number, count: number): Float32Array {
    const out  = new Float32Array(count);
    const step = (endBeat - startBeat) / Math.max(1, count - 1);
    for (let i = 0; i < count; i++) {
      out[i] = this.evaluate(startBeat + i * step);
    }
    return out;
  }

  /** Serialize to JSON (for project save / undo). */
  toJSON(): { config: AutomationCurveConfig; points: AutomationPoint[] } {
    return { config: this.config, points: [...this._points] };
  }

  /** Restore from serialized JSON. */
  static fromJSON(data: {
    config: AutomationCurveConfig;
    points: AutomationPoint[];
  }): AutomationCurve {
    const curve = new AutomationCurve(data.config);
    for (const p of data.points) curve.addPoint(p);
    return curve;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Factory helpers
 * ──────────────────────────────────────────────────────────────────────── */

/** Create a standard volume automation curve (−∞ dB to +6 dB). */
export function createVolumeAutomation(label = 'Volume'): AutomationCurve {
  return new AutomationCurve({
    label, unit: 'dB',
    minValue: -96, maxValue: 6, defaultValue: 0,
  });
}

/** Create a standard pan automation curve (−1 … +1). */
export function createPanAutomation(label = 'Pan'): AutomationCurve {
  return new AutomationCurve({
    label, unit: '',
    minValue: -1, maxValue: 1, defaultValue: 0,
  });
}

/** Create a MIDI CC automation curve (0 … 127). */
export function createMidiCcAutomation(ccNumber: number, label?: string): AutomationCurve {
  return new AutomationCurve({
    label: label ?? `MIDI CC ${ccNumber}`,
    unit: '',
    minValue: 0, maxValue: 127, defaultValue: 64,
  });
}
