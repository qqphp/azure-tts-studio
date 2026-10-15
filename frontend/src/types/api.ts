export interface Voice {
  ShortName: string;
  LocalName?: string;
  DisplayName?: string;
  Locale?: string;
  LocaleName?: string;
  Gender?: string;
  StyleList?: string[];
  VoiceType?: string;
  RolePlayList?: string[];
  Status?: string;
  VoiceTag?: Record<string, string | string[] | undefined>;
}

export interface VoicePreview {
  shortName: string;
  locale: string;
  text: string;
  fileName: string;
  url: string;
  createdAt: number;
  version: number;
  cached?: boolean;
}

export interface HistoryItem {
  id: string;
  ts: number;
  voice?: string;
  text?: string;
  mode?: 'quick' | 'professional';
}

export interface EditorRole {
  id: number;
  name: string;
  voice: Voice;
  rate: string;
  createdAt: number;
}

export interface SoundEffect {
  id: number;
  title: string;
  tags: string[];
  category: string;
  url: string;
  createdAt: number;
}

export interface BackgroundMusic extends SoundEffect {}

export interface Settings {
  endpoint: string;
  apiKey: string;
  defaultVoice: string;
  outputFormat: string;
  theme?: string;
  llm?: { base?: string; apiKey?: string; defaultModel?: string; timeout?: number };
}

export interface LlmModel { id: string; owned_by?: string; }
export interface LlmConnectionResult { ok: boolean; count?: number; error?: string; }

export interface SynthesisResult {
  ok: boolean;
  id: string;
  mime: string;
  meta: HistoryItem;
}

export interface SsmlValidation {
  ok: boolean;
  voiceCount: number;
  voices: string[];
  textLength: number;
  characters: number;
}

export interface ConnectionResult {
  ok: boolean;
  count?: number;
  zh_count?: number;
  error?: string;
}

export interface AiReviewResult {
  ok: boolean;
  model?: string;
  error?: string;
  result?: { tts_text?: string; summary?: string; score?: number | null; issues?: unknown[] };
}
