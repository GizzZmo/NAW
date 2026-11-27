/**
 * ONNX Runtime Web scaffold for neural audio models.
 *
 * This is the first real inference path in NAW. It does not ship model
 * weights. Callers must provide a local or CDN URL to an ONNX file.
 *
 * Usage:
 *   const session = await loadOnnxSession('/models/dac-encoder.onnx');
 *   const result = await runOnnxInference(session, { audio: tensor });
 *
 * See CAPABILITY_STATUS.md for the criteria that must be met before
 * claiming production neural audio generation.
 */

export interface OnnxSessionOptions {
  /** URL or path to the .onnx model file. */
  modelUrl: string;
  /** Execution providers in preference order. */
  executionProviders?: ('webgpu' | 'wasm' | 'cpu')[];
  /** Optional WASM paths if using a custom onnxruntime-web build. */
  wasmPaths?: string;
}

export interface OnnxInferenceResult {
  /** Named outputs from the model. */
  outputs: Record<string, Float32Array | number[]>;
  /** Wall-clock inference time in milliseconds. */
  latencyMs: number;
}

/**
 * Lazy-load onnxruntime-web. Returns null if the package is not installed.
 * Install with: pnpm add onnxruntime-web
 */
export async function tryLoadOrt(): Promise<typeof import('onnxruntime-web') | null> {
  try {
    // Dynamic import so the app still builds if the optional dependency is missing.
    const ort = await import('onnxruntime-web');
    return ort;
  } catch {
    console.warn('[ONNX] onnxruntime-web is not installed. Neural inference unavailable.');
    return null;
  }
}

/**
 * Create an InferenceSession from a model URL.
 * Throws if onnxruntime-web is not available or the model fails to load.
 */
export async function loadOnnxSession(options: OnnxSessionOptions) {
  const ort = await tryLoadOrt();
  if (!ort) {
    throw new Error('onnxruntime-web is not installed. Run: pnpm add onnxruntime-web');
  }

  const providers = options.executionProviders ?? ['webgpu', 'wasm'];
  console.log(`[ONNX] Loading model: ${options.modelUrl}`);
  console.log(`[ONNX] Providers: ${providers.join(', ')}`);

  const session = await ort.InferenceSession.create(options.modelUrl, {
    executionProviders: providers,
    graphOptimizationLevel: 'all',
  });

  console.log(`[ONNX] Model loaded. Inputs: ${session.inputNames.join(', ')}`);
  return session;
}

/**
 * Run a single inference pass.
 * `feeds` maps input names to TypedArrays (typically Float32Array).
 */
export async function runOnnxInference(
  session: Awaited<ReturnType<typeof loadOnnxSession>>,
  feeds: Record<string, Float32Array | Int32Array | BigInt64Array>,
): Promise<OnnxInferenceResult> {
  const ort = await tryLoadOrt();
  if (!ort) throw new Error('onnxruntime-web not available');

  const start = performance.now();
  const ortFeeds: Record<string, import('onnxruntime-web').Tensor> = {};

  for (const [name, data] of Object.entries(feeds)) {
    // Infer a simple rank-1 or rank-2 shape. Callers with multi-dimensional
    // inputs should construct Tensor objects themselves and pass them via a
    // future overload.
    const dims = data.length > 0 ? [1, data.length] : [1];
    ortFeeds[name] = new ort.Tensor(data.constructor.name.includes('BigInt') ? 'int64' : 'float32', data, dims);
  }

  const results = await session.run(ortFeeds);
  const latencyMs = performance.now() - start;

  const outputs: Record<string, Float32Array | number[]> = {};
  for (const [name, tensor] of Object.entries(results)) {
    outputs[name] = Array.from(tensor.data as Float32Array | number[]);
  }

  return { outputs, latencyMs };
}

/**
 * Minimal smoke-test helper. Call after loading a real model to verify
 * the session produces finite values of the expected shape.
 */
export function validateInferenceOutput(
  result: OnnxInferenceResult,
  expectedKeys: string[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const key of expectedKeys) {
    if (!(key in result.outputs)) {
      errors.push(`Missing output key: ${key}`);
      continue;
    }
    const arr = result.outputs[key];
    if (!Array.isArray(arr) && !(arr instanceof Float32Array)) {
      errors.push(`Output ${key} is not an array`);
      continue;
    }
    const hasNonFinite = Array.from(arr).some(v => !Number.isFinite(v));
    if (hasNonFinite) errors.push(`Output ${key} contains non-finite values`);
  }
  return { ok: errors.length === 0, errors };
}
