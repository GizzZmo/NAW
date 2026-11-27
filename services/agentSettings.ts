/**
 * AI agent providers for NAW symbolic generation.
 * User-supplied keys are stored in localStorage and sent with each request.
 * The server never logs them and prefers a user key over env fallbacks.
 */

export type ProviderId = 'gemini' | 'openai' | 'grok' | 'anthropic' | 'openrouter';

export interface ProviderDef {
  id: ProviderId;
  label: string;
  description: string;
  keyPlaceholder: string;
  /** Env var name used as server-side fallback if the user does not supply a key. */
  envFallback?: string;
  /** Whether the provider speaks the OpenAI chat completions API. */
  openAICompatible?: boolean;
  baseUrl?: string;
  model?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Gemini 2.5 Flash (structured JSON)',
    keyPlaceholder: 'AIza…',
    envFallback: 'GEMINI_API_KEY',
    model: 'gemini-2.5-flash',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT-4o / GPT-4.1 (JSON mode)',
    keyPlaceholder: 'sk-…',
    envFallback: 'OPENAI_API_KEY',
    openAICompatible: true,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    id: 'grok',
    label: 'xAI Grok',
    description: 'Grok via xAI API',
    keyPlaceholder: 'xai-…',
    envFallback: 'XAI_API_KEY',
    openAICompatible: true,
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-3',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    description: 'Claude 3.5 / 4 (messages API)',
    keyPlaceholder: 'sk-ant-…',
    envFallback: 'ANTHROPIC_API_KEY',
    model: 'claude-sonnet-4-20250514',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Any model via OpenRouter',
    keyPlaceholder: 'sk-or-…',
    envFallback: 'OPENROUTER_API_KEY',
    openAICompatible: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.5-flash',
  },
];

export const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map(p => [p.id, p])) as Record<ProviderId, ProviderDef>;

const STORAGE_KEY = 'naw.agent.settings.v1';

export interface AgentSettings {
  provider: ProviderId;
  apiKey: string;
  /** Optional model override. */
  modelOverride?: string;
}

/** Basic format checks per provider. Returns an error message or null if valid. */
export function validateApiKey(provider: ProviderId, apiKey: string): string | null {
  const key = apiKey.trim();
  if (!key) return null; // empty is allowed (server env fallback)

  if (key.length < 8 || key.length > 512) {
    return 'API key length looks wrong (8–512 characters).';
  }
  if (/\s/.test(key)) {
    return 'API key should not contain spaces.';
  }

  switch (provider) {
    case 'gemini':
      if (!/^AIza[0-9A-Za-z_\-]{20,}$/.test(key)) {
        return 'Gemini keys usually start with "AIza" followed by a long token.';
      }
      break;
    case 'openai':
      if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(key) && !/^sk-proj-[A-Za-z0-9_\-]{20,}$/.test(key)) {
        return 'OpenAI keys usually start with "sk-" or "sk-proj-".';
      }
      break;
    case 'grok':
      if (!/^xai-[A-Za-z0-9_\-]{20,}$/.test(key)) {
        return 'xAI Grok keys usually start with "xai-".';
      }
      break;
    case 'anthropic':
      if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(key)) {
        return 'Anthropic keys usually start with "sk-ant-".';
      }
      break;
    case 'openrouter':
      if (!/^sk-or-[A-Za-z0-9_\-]{20,}$/.test(key)) {
        return 'OpenRouter keys usually start with "sk-or-".';
      }
      break;
    default:
      break;
  }
  return null;
}

const DEFAULT_SETTINGS: AgentSettings = {
  provider: 'gemini',
  apiKey: '',
};

export function loadAgentSettings(): AgentSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AgentSettings>;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const provider = PROVIDERS.some(p => p.id === parsed.provider) ? parsed.provider as ProviderId : 'gemini';
    return {
      provider,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      modelOverride: typeof parsed.modelOverride === 'string' ? parsed.modelOverride : undefined,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAgentSettings(settings: AgentSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / private mode
  }
}

export function clearAgentSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
