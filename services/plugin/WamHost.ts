/**
 * Web Audio Modules (WAM) Protocol Support
 *
 * Phase 2 Implementation – Plugin Architecture & Compatibility
 *
 * WAM (Web Audio Modules) is the VST-equivalent for the browser, enabling
 * users to load external synths and effects packaged as WebAssembly modules.
 * This service implements the WAM2 host-side protocol, allowing NAW to
 * discover, instantiate, and communicate with WAM plugins.
 *
 * Protocol reference: https://www.webaudiomodules.com/
 *
 * Architecture:
 * ```
 * WamHost
 *   ├── WamPluginRegistry  – discover and load WAM descriptors
 *   ├── WamPluginInstance  – wrap a loaded AudioNode + parameter bridge
 *   └── WamEventBus       – route MIDI/automation to/from plugins
 * ```
 *
 * @see services/plugin/VstClapBridge.ts  (CLAP/VST3 host bridge)
 * @see ROADMAP.md § Phase 2.1
 */

/* ──────────────────────────────────────────────────────────────────────────
 * WAM2 type stubs
 * (The real WAM SDK provides these at runtime via the wam-controller script.)
 * ──────────────────────────────────────────────────────────────────────── */

/** WAM descriptor retrieved from a plugin's `descriptor.json`. */
export interface WamDescriptor {
  /** Unique namespace, e.g. "com.vendor.PluginName" */
  identifier: string;
  /** Human-readable name */
  name: string;
  /** Vendor display name */
  vendor: string;
  /** Plugin version string */
  version: string;
  /** Plugin category (Instrument | Effect | Analyzer | Other) */
  category: 'Instrument' | 'Effect' | 'Analyzer' | 'Other';
  /** Short description */
  description: string;
  /** URL to thumbnail image */
  thumbnailUrl?: string;
  /** Keywords for search */
  keywords?: string[];
}

/** Runtime parameter exposed by a WAM plugin. */
export interface WamParameter {
  /** Unique parameter ID within the plugin */
  id: string;
  /** Human-readable label */
  label: string;
  /** Minimum value */
  minValue: number;
  /** Maximum value */
  maxValue: number;
  /** Default value */
  defaultValue: number;
  /** Current value */
  value: number;
  /** Unit string (e.g. "dB", "Hz", "%") */
  unit?: string;
}

/** MIDI or automation event passed to a WAM plugin. */
export interface WamEvent {
  /** Event type */
  type: 'midi' | 'automation' | 'sysex';
  /** AudioContext time for sample-accurate delivery */
  time: number;
  /** MIDI bytes (for 'midi' events) */
  data?: Uint8Array;
  /** Parameter automation (for 'automation' events) */
  paramId?: string;
  paramValue?: number;
}

/** Lifecycle status of a loaded WAM plugin instance. */
export type WamInstanceStatus = 'loading' | 'ready' | 'error' | 'disposed';

/* ──────────────────────────────────────────────────────────────────────────
 * WamPluginInstance
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Wraps a single loaded WAM plugin, providing a uniform API for parameter
 * access, event scheduling, and Web Audio graph integration.
 */
export class WamPluginInstance {
  public readonly descriptor: WamDescriptor;
  public status: WamInstanceStatus = 'loading';

  /** The plugin's Web Audio output node (connect to mixer). */
  public outputNode: AudioNode | null = null;

  private _parameters = new Map<string, WamParameter>();
  private _pendingEvents: WamEvent[] = [];

  constructor(descriptor: WamDescriptor) {
    this.descriptor = descriptor;
  }

  /**
   * Simulate initialization of the WAM plugin.
   *
   * In a real implementation this calls `WAM.createInstance(ctx, url)` which
   * loads the WebAssembly module and returns an AudioNode.
   */
  async initialize(_audioContext: AudioContext): Promise<void> {
    // Stub: mark as ready after a simulated async load
    await Promise.resolve();
    this.status = 'ready';
  }

  /** Return all parameters exposed by the plugin. */
  getParameters(): WamParameter[] {
    return Array.from(this._parameters.values());
  }

  /** Get a single parameter by ID. */
  getParameter(id: string): WamParameter | undefined {
    return this._parameters.get(id);
  }

  /**
   * Set a parameter value.
   * Validates against min/max and updates internal state.
   */
  setParameter(id: string, value: number): void {
    const param = this._parameters.get(id);
    if (!param) return;
    param.value = Math.max(param.minValue, Math.min(param.maxValue, value));
  }

  /**
   * Send a sample-accurate MIDI or automation event to the plugin.
   *
   * Events are queued and dispatched in the next audio-render cycle.
   */
  scheduleEvent(event: WamEvent): void {
    this._pendingEvents.push(event);
  }

  /** Flush queued events (called by WamHost each scheduler tick). */
  flushEvents(): WamEvent[] {
    const batch = this._pendingEvents.slice();
    this._pendingEvents.length = 0;
    return batch;
  }

  /** Tear down the plugin and release its AudioNode. */
  dispose(): void {
    this.outputNode?.disconnect();
    this.outputNode = null;
    this.status = 'disposed';
  }

  /** Serialize plugin state to JSON (for project save). */
  serializeState(): Record<string, unknown> {
    const params: Record<string, number> = {};
    for (const [id, p] of this._parameters) params[id] = p.value;
    return { identifier: this.descriptor.identifier, parameters: params };
  }

  /** Restore plugin state from saved JSON. */
  restoreState(state: Record<string, unknown>): void {
    const params = state['parameters'] as Record<string, number> | undefined;
    if (!params) return;
    for (const [id, value] of Object.entries(params)) {
      this.setParameter(id, value);
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * WamHost
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * WAM host manager – discovers, loads, and manages WAM plugin instances.
 *
 * @example
 * ```typescript
 * const host = new WamHost(audioContext);
 * await host.registerPlugin('https://cdn.example.com/my-synth/descriptor.json');
 * const instance = await host.loadPlugin('com.example.MySynth');
 * instance.outputNode?.connect(masterGain);
 * ```
 */
export class WamHost {
  private readonly _registry = new Map<string, WamDescriptor>();
  private readonly _instances = new Map<string, WamPluginInstance>();
  private readonly _audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this._audioContext = audioContext;
  }

  /**
   * Register a WAM plugin by fetching its descriptor JSON.
   *
   * In production this fetches the remote descriptor and validates it.
   * The stub version accepts a pre-built descriptor object directly.
   */
  async registerPlugin(descriptorOrUrl: string | WamDescriptor): Promise<WamDescriptor> {
    let descriptor: WamDescriptor;

    if (typeof descriptorOrUrl === 'string') {
      // Stub: simulate a fetch
      await Promise.resolve();
      // Return a placeholder – real implementation would `fetch(url)`
      descriptor = {
        identifier: 'com.stub.Plugin',
        name: 'Stub Plugin',
        vendor: 'NAW Stub',
        version: '0.0.1',
        category: 'Effect',
        description: `Plugin loaded from ${descriptorOrUrl}`,
      };
    } else {
      descriptor = descriptorOrUrl;
    }

    this._registry.set(descriptor.identifier, descriptor);
    return descriptor;
  }

  /** List all registered plugin descriptors. */
  getRegisteredPlugins(): WamDescriptor[] {
    return Array.from(this._registry.values());
  }

  /**
   * Instantiate a registered plugin by its identifier.
   *
   * @param identifier - Unique plugin identifier (e.g. "com.vendor.Synth")
   * @returns The live WamPluginInstance
   */
  async loadPlugin(identifier: string): Promise<WamPluginInstance> {
    const descriptor = this._registry.get(identifier);
    if (!descriptor) {
      throw new Error(`WAM plugin not registered: ${identifier}`);
    }

    const instance = new WamPluginInstance(descriptor);
    await instance.initialize(this._audioContext);
    this._instances.set(identifier, instance);
    return instance;
  }

  /** Get a previously loaded plugin instance. */
  getInstance(identifier: string): WamPluginInstance | undefined {
    return this._instances.get(identifier);
  }

  /** List all currently loaded instances. */
  getLoadedPlugins(): WamPluginInstance[] {
    return Array.from(this._instances.values());
  }

  /** Unload a plugin instance and remove it from the active set. */
  unloadPlugin(identifier: string): void {
    const instance = this._instances.get(identifier);
    instance?.dispose();
    this._instances.delete(identifier);
  }

  /** Dispatch scheduled events to all loaded plugins. */
  flushEvents(): void {
    for (const instance of this._instances.values()) {
      instance.flushEvents(); // Real implementation forwards to WAM runtime
    }
  }

  /** Tear down all plugins and clean up. */
  dispose(): void {
    for (const instance of this._instances.values()) {
      instance.dispose();
    }
    this._instances.clear();
    this._registry.clear();
  }
}
