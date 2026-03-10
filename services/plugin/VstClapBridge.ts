/**
 * VST3 / CLAP Plugin Bridge
 *
 * Phase 2 Implementation – Plugin Architecture & Compatibility
 *
 * Provides a host-side abstraction for loading and communicating with
 * native audio plugins in a desktop wrapper environment (Electron, Tauri,
 * or a C++ backend communicating via N-API / IPC).
 *
 * Supported plugin formats:
 *   • CLAP (Clever Audio Plug-in API) – open-source, multi-threaded modulation
 *   • VST3 (Steinberg VST3 SDK)
 *
 * The bridge speaks a JSON-RPC–style IPC protocol so that a native host
 * process (e.g., a Rust/C++ sidecar) can expose plugins to the JS frontend
 * without the JS thread having to link against plugin SDKs directly.
 *
 * @see services/plugin/WamHost.ts      (browser WAM plugins)
 * @see services/plugin/NApiBridge.ts   (C++ DSP via N-API)
 * @see ROADMAP.md § Phase 2.2
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Plugin format enum
 * ──────────────────────────────────────────────────────────────────────── */

/** Supported native plugin formats. */
export enum PluginFormat {
  CLAP = 'CLAP',
  VST3 = 'VST3',
}

/* ──────────────────────────────────────────────────────────────────────────
 * Plugin descriptor
 * ──────────────────────────────────────────────────────────────────────── */

/** Metadata for a discovered native plugin. */
export interface NativePluginDescriptor {
  /** Unique plugin identifier (CLAP id or VST3 class GUID) */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Vendor / manufacturer name */
  vendor: string;
  /** Plugin version string */
  version: string;
  /** Plugin format */
  format: PluginFormat;
  /**
   * Plugin category.
   * Mirrors CLAP plugin_category and VST3 CPluginCategoryType.
   */
  category: 'Instrument' | 'Effect' | 'Analyzer' | 'Other';
  /** Absolute path to the plugin binary on disk */
  path: string;
  /** Whether the plugin supports multi-threaded modulation (CLAP-specific) */
  supportsMultiThreadedModulation?: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Plugin parameter
 * ──────────────────────────────────────────────────────────────────────── */

/** A single automatable parameter exposed by a native plugin. */
export interface NativePluginParameter {
  id: string;
  name: string;
  module?: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  value: number;
  flags: {
    /** Can be automated from the DAW host */
    isAutomatable: boolean;
    /** Modulation is supported in addition to automation */
    isModulatable?: boolean;
    /** CLAP: can be modulated per-sample on the audio thread */
    supportsPerNoteAutomation?: boolean;
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * IPC message types
 * ──────────────────────────────────────────────────────────────────────── */

/** Message sent from JS frontend to native host process. */
export interface IpcRequest {
  method: string;
  id: number;
  params?: Record<string, unknown>;
}

/** Message received from native host process. */
export interface IpcResponse {
  id: number;
  result?: unknown;
  error?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * NativePluginInstance
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Represents a running instance of a CLAP or VST3 plugin.
 *
 * All heavy lifting (audio rendering, state queries) is delegated to the
 * native host process via `VstClapBridge._ipcCall()`.
 */
export class NativePluginInstance {
  public readonly descriptor: NativePluginDescriptor;
  /** Unique handle assigned by the native host process */
  public readonly handle: string;

  private _parameters = new Map<string, NativePluginParameter>();
  private _bridge: VstClapBridge;

  constructor(
    descriptor: NativePluginDescriptor,
    handle: string,
    bridge: VstClapBridge,
  ) {
    this.descriptor = descriptor;
    this.handle     = handle;
    this._bridge    = bridge;
  }

  /** Request the current parameter list from the native process. */
  async refreshParameters(): Promise<NativePluginParameter[]> {
    const params = await this._bridge._ipcCall<NativePluginParameter[]>(
      'plugin.getParameters',
      { handle: this.handle },
    );
    this._parameters.clear();
    for (const p of params) this._parameters.set(p.id, p);
    return params;
  }

  /** Set a parameter value on the native process. */
  async setParameter(id: string, value: number): Promise<void> {
    const param = this._parameters.get(id);
    if (!param) return;
    param.value = Math.max(param.minValue, Math.min(param.maxValue, value));
    await this._bridge._ipcCall('plugin.setParameter', {
      handle: this.handle,
      paramId: id,
      value: param.value,
    });
  }

  /** Open the plugin's native GUI window. */
  async openEditor(): Promise<void> {
    await this._bridge._ipcCall('plugin.openEditor', { handle: this.handle });
  }

  /** Close the plugin's native GUI window. */
  async closeEditor(): Promise<void> {
    await this._bridge._ipcCall('plugin.closeEditor', { handle: this.handle });
  }

  /** Serialize plugin state to a Base64 blob for project save. */
  async getState(): Promise<string> {
    return this._bridge._ipcCall<string>('plugin.getState', {
      handle: this.handle,
    });
  }

  /** Restore plugin state from a previously saved Base64 blob. */
  async setState(blob: string): Promise<void> {
    await this._bridge._ipcCall('plugin.setState', {
      handle: this.handle,
      state: blob,
    });
  }

  /** Unload this instance from the native process. */
  async dispose(): Promise<void> {
    await this._bridge._ipcCall('plugin.destroy', { handle: this.handle });
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * VstClapBridge
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Host-side bridge for communicating with a native CLAP / VST3 host process.
 *
 * @example
 * ```typescript
 * const bridge = new VstClapBridge();
 * await bridge.connect();
 *
 * const plugins = await bridge.scanPlugins('/Library/Audio/Plug-Ins/CLAP');
 * const instance = await bridge.loadPlugin(plugins[0].id);
 * await instance.openEditor();
 * ```
 */
export class VstClapBridge {
  private _connected = false;
  private _pendingRequests = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private _requestCounter = 0;

  /** IPC transport (populated by connect()). */
  private _sendMessage: ((msg: IpcRequest) => void) | null = null;

  /**
   * Connect to the native host process.
   *
   * In Electron this wires up `ipcRenderer`; in Tauri it uses `invoke()`;
   * in a plain browser context it operates in stub mode.
   */
  async connect(): Promise<void> {
    // Stub: in a real desktop environment we would set up IPC here
    this._sendMessage = (_msg: IpcRequest) => {
      // Simulate an immediate successful response using a microtask
      queueMicrotask(() => {
        const resp: IpcResponse = {
          id: _msg.id,
          result: this._stubResponse(_msg.method, _msg.params),
        };
        this._handleResponse(resp);
      });
    };
    this._connected = true;
  }

  /** Scan a directory for CLAP or VST3 plugins. */
  async scanPlugins(directory: string): Promise<NativePluginDescriptor[]> {
    return this._ipcCall<NativePluginDescriptor[]>('host.scanPlugins', {
      directory,
    });
  }

  /**
   * Instantiate a plugin by its ID.
   *
   * @param pluginId - CLAP plugin id or VST3 GUID
   * @returns Live `NativePluginInstance`
   */
  async loadPlugin(pluginId: string): Promise<NativePluginInstance> {
    const descriptor = await this._ipcCall<NativePluginDescriptor>(
      'host.loadPlugin',
      { pluginId },
    );
    const handle = await this._ipcCall<string>('plugin.create', { pluginId });
    return new NativePluginInstance(descriptor, handle, this);
  }

  /** Disconnect from the native host process. */
  disconnect(): void {
    this._sendMessage = null;
    this._connected = false;
  }

  get connected(): boolean {
    return this._connected;
  }

  /**
   * Internal: send an IPC call and await its response.
   * @internal
   */
  async _ipcCall<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this._sendMessage) {
      throw new Error('VstClapBridge not connected');
    }
    const id = ++this._requestCounter;
    return new Promise<T>((resolve, reject) => {
      this._pendingRequests.set(id, {
        resolve: v => resolve(v as T),
        reject,
      });
      this._sendMessage!({ method, id, params });
    });
  }

  private _handleResponse(resp: IpcResponse): void {
    const pending = this._pendingRequests.get(resp.id);
    if (!pending) return;
    this._pendingRequests.delete(resp.id);
    if (resp.error) {
      pending.reject(new Error(resp.error));
    } else {
      pending.resolve(resp.result);
    }
  }

  /** Stub response generator for testing without a native host. */
  private _stubResponse(
    method: string,
    params?: Record<string, unknown>,
  ): unknown {
    switch (method) {
      case 'host.scanPlugins':
        return [] as NativePluginDescriptor[];
      case 'host.loadPlugin':
        return {
          id: String(params?.['pluginId'] ?? 'stub'),
          name: 'Stub Plugin',
          vendor: 'NAW',
          version: '0.0.1',
          format: PluginFormat.CLAP,
          category: 'Effect',
          path: '/stub/plugin.clap',
        } satisfies NativePluginDescriptor;
      case 'plugin.create':
        return `handle_${Date.now()}`;
      case 'plugin.getParameters':
        return [] as NativePluginParameter[];
      case 'plugin.getState':
        return '';
      default:
        return null;
    }
  }
}

/** Singleton bridge instance for the application. */
export const vstClapBridge = new VstClapBridge();
