/**
 * Discrete diffusion helpers for token-level inpainting.
 *
 * Operates on discrete RVQ / codebook indices (not continuous latents).
 * Provides a simple iterative denoise loop that can be driven by a real
 * model when an ONNX session is supplied.
 */

export interface DiscreteDiffusionConfig {
  /** Number of diffusion steps. */
  steps: number;
  /** Vocabulary size per codebook. */
  codebookSize: number;
  /** Mask token id (typically codebookSize). */
  maskToken: number;
}

export const DEFAULT_DISCRETE_DIFFUSION: DiscreteDiffusionConfig = {
  steps: 16,
  codebookSize: 1024,
  maskToken: 1024,
};

/**
 * Apply a single discrete diffusion step.
 * If a modelFn is provided it predicts clean tokens; otherwise a random
 * unmask is used (stub).
 */
export function discreteDiffusionStep(
  tokens: number[][],
  step: number,
  totalSteps: number,
  config: DiscreteDiffusionConfig = DEFAULT_DISCRETE_DIFFUSION,
  modelFn?: (masked: number[][]) => number[][],
): number[][] {
  const t = 1 - step / totalSteps;
  const maskProb = Math.max(0.05, t);

  const masked = tokens.map(row =>
    row.map(tok => (Math.random() < maskProb ? config.maskToken : tok)),
  );

  if (modelFn) {
    return modelFn(masked);
  }

  // Stub: randomly fill masks
  return masked.map(row =>
    row.map(tok =>
      tok === config.maskToken
        ? Math.floor(Math.random() * config.codebookSize)
        : tok,
    ),
  );
}

/**
 * Run a full discrete diffusion inpainting loop.
 * `known` positions are preserved (inpainting mask).
 */
export function runDiscreteInpainting(
  initial: number[][],
  knownMask: boolean[][],
  config: DiscreteDiffusionConfig = DEFAULT_DISCRETE_DIFFUSION,
  modelFn?: (masked: number[][]) => number[][],
): number[][] {
  let tokens = initial.map(row => [...row]);
  for (let s = 0; s < config.steps; s++) {
    tokens = discreteDiffusionStep(tokens, s, config.steps, config, modelFn);
    // Re-apply known tokens
    tokens = tokens.map((row, i) =>
      row.map((tok, j) => (knownMask[i]?.[j] ? initial[i][j] : tok)),
    );
  }
  return tokens;
}
