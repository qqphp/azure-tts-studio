import type { AiReviewResult, BackgroundMusic, ConnectionResult, EditorRole, HistoryItem, LlmConnectionResult, LlmModel, LlmProvider, Settings, SoundEffect, SsmlValidation, SynthesisResult, Voice } from '../types/api';

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
  editorRoles: () => request<EditorRole[]>('/api/editor/roles'),
  createEditorRole: (data: { name: string; voice: Voice }) => request<EditorRole>('/api/editor/roles', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  updateEditorRole: (id: number, data: { name: string; rate: string; voice?: Voice }) => request<EditorRole>(`/api/editor/roles/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  deleteEditorRole: (id: number) => request<{ ok: boolean }>(`/api/editor/roles/${id}`, { method: 'DELETE' }),
  soundEffects: () => request<SoundEffect[]>('/api/sound-effects'),
  createSoundEffect: (data: Omit<SoundEffect, 'id' | 'createdAt'>) => request<SoundEffect>('/api/sound-effects', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  updateSoundEffect: (id: number, data: Omit<SoundEffect, 'id' | 'createdAt'>) => request<SoundEffect>(`/api/sound-effects/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  deleteSoundEffect: (id: number) => request<{ ok: boolean }>(`/api/sound-effects/${id}`, { method: 'DELETE' }),
  deleteSoundEffectsBatch: (ids: number[]) => request<{ ok: boolean; deleted: number; missing: number[] }>('/api/sound-effects/batch-delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
  }),
  backgroundMusic: () => request<BackgroundMusic[]>('/api/background-music'),
  createBackgroundMusic: (data: Omit<BackgroundMusic, 'id' | 'createdAt'>) => request<BackgroundMusic>('/api/background-music', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  updateBackgroundMusic: (id: number, data: Omit<BackgroundMusic, 'id' | 'createdAt'>) => request<BackgroundMusic>(`/api/background-music/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }),
  deleteBackgroundMusic: (id: number) => request<{ ok: boolean }>(`/api/background-music/${id}`, { method: 'DELETE' }),
  deleteBackgroundMusicBatch: (ids: number[]) => request<{ ok: boolean; deleted: number; missing: number[] }>('/api/background-music/batch-delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
  }),
  history: () => request<HistoryItem[]>('/api/history'),
  deleteHistory: (id: string) => request<{ ok: boolean }>(`/api/history/${id}`, { method: 'DELETE' }),
  deleteHistoryBatch: (ids: string[]) => request<{ ok: boolean; deleted: number; missing: string[] }>('/api/history/batch-delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
  }),
  speak: (data: { text: string; voice?: string; rate?: string; pitch?: string; volume?: string; style?: string; role?: string }) => request<SynthesisResult>('/api/speak', {
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
