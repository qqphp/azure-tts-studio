import type { AiReviewResult, ConnectionResult, HistoryItem, LlmConnectionResult, LlmModel, LlmProvider, Settings, SsmlValidation, SynthesisResult, Voice } from '../types/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `请求失败（HTTP ${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),
  settings: () => request<Settings>('/api/settings'),
  saveSettings: (data: Partial<Settings>) => request<Settings>('/api/settings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  voices: () => request<Voice[]>('/api/voices'),
  favoriteVoices: () => request<string[]>('/api/voices/favorites'),
  favoriteVoiceItems: () => request<Voice[]>('/api/voices/favorites/items'),
  addFavoriteVoice: (voice: Voice) => request<{ ok: boolean }>(`/api/voices/favorites/${encodeURIComponent(voice.ShortName)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(voice) }),
  removeFavoriteVoice: (shortName: string) => request<{ ok: boolean }>(`/api/voices/favorites/${encodeURIComponent(shortName)}`, { method: 'DELETE' }),
  history: () => request<HistoryItem[]>('/api/history'),
  deleteHistory: (id: string) => request<{ ok: boolean }>(`/api/history/${id}`, { method: 'DELETE' }),
  deleteHistoryBatch: (ids: string[]) => request<{ ok: boolean; deleted: number; missing: string[] }>('/api/history/batch-delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
  }),
  speak: (data: { text: string; voice?: string; rate?: string; pitch?: string; volume?: string; style?: string }) => request<SynthesisResult>('/api/speak', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  validateSsml: (ssml: string) => request<SsmlValidation>('/api/ssml/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ssml }),
  }),
  speakSsml: (ssml: string) => request<SynthesisResult>('/api/speak-ssml', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ssml }),
  }),
  testConnection: () => request<ConnectionResult>('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  llmStatus: () => request<{ configured: boolean; model: string }>('/api/llm/status'),
  llmProviders: () => request<LlmProvider[]>('/api/llm/providers'),
  llmModels: () => request<LlmModel[]>('/api/llm/models'),
  testLlm: () => request<LlmConnectionResult>('/api/llm/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  reviewText: (text: string) => request<AiReviewResult>('/api/llm/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }),
};
