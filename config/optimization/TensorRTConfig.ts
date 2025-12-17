/**
 * TensorRT Optimization Configuration
 * 
 * Phase 4 Implementation - Performance Optimization
 * 
 * TensorRT is NVIDIA's high-performance inference optimizer.
 * This configuration defines optimization strategies for NAW's neural models.
 * 
 * Key optimizations:
 * - Graph optimization and layer fusion
 * - Mixed precision (FP16/INT8)
 * - Dynamic tensor memory
 * - Kernel auto-tuning
 * 
 * Target: <100ms latency for real-time inference
 * 
 * @see ROADMAP.md § Phase 4.2
 */

/**
 * Precision mode for inference
 */
export enum PrecisionMode {
  /** Full 32-bit precision (highest quality, slowest) */
  FP32 = 'FP32',
  /** Half precision (good quality, 2x faster) */
  FP16 = 'FP16',
  /** 8-bit integer (lower quality, 4x faster) */
  INT8 = 'INT8',
  /** Mixed precision (automatic selection) */
  MIXED = 'MIXED',
}

/**
 * TensorRT optimization level
 */
export enum OptimizationLevel {
  /** Minimal optimization (fastest build) */
  O0 = 'O0',
  /** Basic optimization */
  O1 = 'O1',
  /** Moderate optimization (balanced) */
  O2 = 'O2',
  /** Aggressive optimization (slowest build, fastest inference) */
  O3 = 'O3',
}

/**
 * TensorRT configuration
 */
export interface TensorRTConfig {
  /** Precision mode */
  precision: PrecisionMode;
  
  /** Optimization level */
  optimizationLevel: OptimizationLevel;
  
  /** Maximum batch size */
  maxBatchSize: number;
  
  /** Maximum workspace size (MB) */
  maxWorkspaceSize: number;
  
  /** Enable layer fusion */
  enableLayerFusion: boolean;
  
  /** Enable kernel auto-tuning */
  enableAutoTuning: boolean;
  
  /** Enable dynamic shapes */
  enableDynamicShapes: boolean;
  
  /** Calibration dataset path (for INT8) */
  calibrationDataPath?: string;
  
  /** Engine cache directory */
  engineCacheDir: string;
}

/**
 * Default TensorRT configuration (balanced)
 */
export const DEFAULT_TENSORRT_CONFIG: TensorRTConfig = {
  precision: PrecisionMode.FP16,
  optimizationLevel: OptimizationLevel.O2,
  maxBatchSize: 1,
  maxWorkspaceSize: 4096, // 4GB
  enableLayerFusion: true,
  enableAutoTuning: true,
  enableDynamicShapes: true,
  engineCacheDir: './tensorrt_cache',
};

/**
 * Performance presets
 */
export const TENSORRT_PRESETS = {
  /**
   * Real-time preset: Optimize for lowest latency
   * Target: <100ms for 1 bar generation
   */
  REALTIME: {
    precision: PrecisionMode.FP16,
    optimizationLevel: OptimizationLevel.O3,
    maxBatchSize: 1,
    maxWorkspaceSize: 2048,
    enableLayerFusion: true,
    enableAutoTuning: true,
    enableDynamicShapes: false, // Static shapes faster
    engineCacheDir: './tensorrt_cache',
  } as TensorRTConfig,

  /**
   * Quality preset: Optimize for best quality
   */
  QUALITY: {
    precision: PrecisionMode.FP32,
    optimizationLevel: OptimizationLevel.O2,
    maxBatchSize: 1,
    maxWorkspaceSize: 8192,
    enableLayerFusion: true,
    enableAutoTuning: true,
    enableDynamicShapes: true,
    engineCacheDir: './tensorrt_cache',
  } as TensorRTConfig,

  /**
   * Batch preset: Optimize for throughput
   */
  BATCH: {
    precision: PrecisionMode.FP16,
    optimizationLevel: OptimizationLevel.O2,
    maxBatchSize: 8,
    maxWorkspaceSize: 4096,
    enableLayerFusion: true,
    enableAutoTuning: true,
    enableDynamicShapes: true,
    engineCacheDir: './tensorrt_cache',
  } as TensorRTConfig,
};

/**
 * Model-specific optimization configurations
 */
export const MODEL_OPTIMIZATIONS = {
  /**
   * DAC Codec optimization
   * - Lightweight model, FP16 sufficient
   * - Real-time encoding/decoding required
   */
  DAC_CODEC: {
    precision: PrecisionMode.FP16,
    optimizationLevel: OptimizationLevel.O3,
    maxBatchSize: 1,
    maxWorkspaceSize: 1024,
    enableLayerFusion: true,
    enableAutoTuning: true,
    enableDynamicShapes: false,
    engineCacheDir: './tensorrt_cache/dac',
  } as TensorRTConfig,

  /**
   * Semantic Planner optimization
   * - Autoregressive, latency-critical
   * - KV-cache needs dynamic shapes
   */
  SEMANTIC_PLANNER: {
    precision: PrecisionMode.FP16,
    optimizationLevel: OptimizationLevel.O3,
    maxBatchSize: 1,
    maxWorkspaceSize: 2048,
    enableLayerFusion: true,
    enableAutoTuning: true,
    enableDynamicShapes: true, // For KV-cache
    engineCacheDir: './tensorrt_cache/planner',
  } as TensorRTConfig,

  /**
   * Acoustic Renderer optimization
   * - Largest model, most compute-intensive
   * - Can tolerate slightly higher latency
   */
  ACOUSTIC_RENDERER: {
    precision: PrecisionMode.FP16,
    optimizationLevel: OptimizationLevel.O3,
    maxBatchSize: 1,
    maxWorkspaceSize: 8192,
    enableLayerFusion: true,
    enableAutoTuning: true,
    enableDynamicShapes: false,
    engineCacheDir: './tensorrt_cache/renderer',
  } as TensorRTConfig,
};

/**
 * Hardware-specific configurations
 */
export interface HardwareConfig {
  /** GPU name */
  name: string;
  
  /** Compute capability */
  computeCapability: string;
  
  /** Recommended precision */
  recommendedPrecision: PrecisionMode;
  
  /** Estimated latency (ms) */
  estimatedLatency: {
    fp32: number;
    fp16: number;
    int8: number;
  };
}

/**
 * GPU performance profiles
 */
export const GPU_PROFILES: Record<string, HardwareConfig> = {
  RTX_4090: {
    name: 'NVIDIA RTX 4090',
    computeCapability: '8.9',
    recommendedPrecision: PrecisionMode.FP16,
    estimatedLatency: {
      fp32: 150,
      fp16: 75,
      int8: 40,
    },
  },
  RTX_3090: {
    name: 'NVIDIA RTX 3090',
    computeCapability: '8.6',
    recommendedPrecision: PrecisionMode.FP16,
    estimatedLatency: {
      fp32: 200,
      fp16: 100,
      int8: 55,
    },
  },
  RTX_3060: {
    name: 'NVIDIA RTX 3060',
    computeCapability: '8.6',
    recommendedPrecision: PrecisionMode.FP16,
    estimatedLatency: {
      fp32: 350,
      fp16: 180,
      int8: 95,
    },
  },
  GTX_1660: {
    name: 'NVIDIA GTX 1660',
    computeCapability: '7.5',
    recommendedPrecision: PrecisionMode.FP32, // No Tensor Cores
    estimatedLatency: {
      fp32: 500,
      fp16: 500, // No speedup
      int8: 280,
    },
  },
};

/**
 * INT8 calibration configuration
 */
export interface CalibrationConfig {
  /** Number of calibration samples */
  numSamples: number;
  
  /** Calibration algorithm */
  algorithm: 'ENTROPY' | 'PERCENTILE' | 'MINMAX';
  
  /** Percentile value (for PERCENTILE algorithm) */
  percentile?: number;
  
  /** Calibration batch size */
  batchSize: number;
}

/**
 * Default calibration configuration for INT8
 */
export const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig = {
  numSamples: 1000,
  algorithm: 'ENTROPY',
  batchSize: 10,
};

/**
 * Latency budget breakdown (target: <100ms total)
 */
export const LATENCY_BUDGET = {
  /** Audio encoding (DAC) */
  ENCODING: 10, // ms
  
  /** Semantic planning (AR Transformer) */
  PLANNING: 30, // ms
  
  /** Acoustic rendering (Flow Matching) */
  RENDERING: 50, // ms
  
  /** Audio decoding (DAC) */
  DECODING: 10, // ms
  
  /** Total budget */
  TOTAL: 100, // ms
};

/**
 * Check if hardware can achieve real-time performance
 */
export function canAchieveRealTime(gpuProfile: HardwareConfig): boolean {
  // Use FP16 latency as reference
  return gpuProfile.estimatedLatency.fp16 < LATENCY_BUDGET.TOTAL;
}

/**
 * Select optimal precision for hardware
 */
export function selectOptimalPrecision(
  gpuProfile: HardwareConfig,
  qualityThreshold: number = 0.9
): PrecisionMode {
  // If FP16 meets latency budget, use it (best quality/speed tradeoff)
  if (gpuProfile.estimatedLatency.fp16 < LATENCY_BUDGET.TOTAL) {
    return PrecisionMode.FP16;
  }

  // If INT8 needed for real-time, check if quality is acceptable
  if (gpuProfile.estimatedLatency.int8 < LATENCY_BUDGET.TOTAL) {
    return PrecisionMode.INT8;
  }

  // Fallback to FP16 (will be slower than real-time)
  return PrecisionMode.FP16;
}
