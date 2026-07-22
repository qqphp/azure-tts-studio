import type { Voice } from './types/api';

export const localeNames: Record<string, string> = { 'zh-CN': '中文（普通话）', 'zh-TW': '中文（繁体）', 'en-US': '英语（美国）', 'en-GB': '英语（英国）', 'ja-JP': '日语', 'ko-KR': '韩语' };
export const roleLabels: Record<string, string> = { Boy: '男孩', Girl: '女孩', YoungAdultMale: '青年男性', YoungAdultFemale: '青年女性', OlderAdultMale: '中老年男性', OlderAdultFemale: '中老年女性', SeniorMale: '老年男性', SeniorFemale: '老年女性', Narrator: '旁白' };
export const typeLabels: Record<string, string> = { Neural: '神经网络', Standard: '标准', OnlineNatural: '自然语音' };
export const statusLabels: Record<string, string> = { GA: '正式版', Preview: '预览版', Deprecated: '已弃用' };
export const scenarioLabels: Record<string, string> = { advertisement: '广告', assistant: '语音助手', audiobook: '有声书', audiobooks: '有声书', chat: '聊天对话', 'customer service': '客户服务', documentary: '纪录片', 'e-learning': '在线学习', gaming: '游戏', learning: '学习', meditation: '冥想', narration: '旁白', news: '新闻播报', podcast: '播客', 'social media': '社交媒体', story: '故事讲述', 'call center': '呼叫中心', conversation: '对话' };
export const personalityLabels: Record<string, string> = { animated: '生动', approachable: '平易近人', authentic: '真诚自然', authoritative: '权威', bright: '明亮', calm: '平静', caring: '关怀', casual: '轻松', cheerful: '开朗', clear: '清晰', confident: '自信', crisp: '清脆', deep: '深沉', emotional: '富有情感', empathetic: '善解人意', engaging: '吸引人', expressive: '富有表现力', formal: '正式', friendly: '友好', gentle: '温和', hoarse: '沙哑', mature: '成熟', pleasant: '悦耳', polite: '礼貌', professional: '专业', serious: '严肃', sincere: '真挚', smooth: '圆润', soft: '柔和', soothing: '舒缓', strong: '有力量', upbeat: '积极', versatile: '多变', warm: '温暖', youthful: '青春' };

export type VoiceFilterState = {
  keyword: string;
  locale: string;
  gender: string;
  type: string;
  role: string;
  status: string;
  scenario: string;
  personality: string;
  model: string;
  source: string;
  styleOnly: boolean;
};

export const initialVoiceFilters: VoiceFilterState = { keyword: '', locale: '', gender: '', type: '', role: '', status: '', scenario: '', personality: '', model: '', source: '', styleOnly: false };

export const tagValues = (voice: Voice, key: string) => {
  const value = voice.VoiceTag?.[key];
  return Array.isArray(value) ? value : value ? [value] : [];
};

const valuesOf = (voices: Voice[], getter: (voice: Voice) => string | string[] | undefined) => [...new Set(voices.flatMap((voice) => {
  const value = getter(voice);
  return Array.isArray(value) ? value : value ? [value] : [];
}).filter(Boolean))].sort((a, b) => a.localeCompare(b));

const hasValue = (value: string | string[] | undefined, selected: string) => !selected || (Array.isArray(value) ? value : value ? [value] : []).includes(selected);

export const localizedLabel = (value: string, labels: Record<string, string>) => labels[value] || labels[value.toLowerCase()] || value;

export const voiceFilterOptions = (voices: Voice[]) => ({
  locales: valuesOf(voices, (voice) => voice.Locale),
  types: valuesOf(voices, (voice) => voice.VoiceType),
  roles: valuesOf(voices, (voice) => voice.RolePlayList),
  statuses: valuesOf(voices, (voice) => voice.Status),
  scenarios: valuesOf(voices, (voice) => tagValues(voice, 'TailoredScenarios')),
  personalities: valuesOf(voices, (voice) => tagValues(voice, 'VoicePersonalities')),
  models: valuesOf(voices, (voice) => tagValues(voice, 'ModelSeries')),
  sources: valuesOf(voices, (voice) => tagValues(voice, 'Source')),
});

export const filterVoices = (voices: Voice[], filters: VoiceFilterState) => voices.filter((voice) => {
  const query = filters.keyword.trim().toLowerCase();
  const searchable = [voice.ShortName, voice.LocalName, voice.DisplayName, voice.Locale, voice.LocaleName, voice.StyleList, voice.RolePlayList, tagValues(voice, 'TailoredScenarios'), tagValues(voice, 'VoicePersonalities'), tagValues(voice, 'ModelSeries'), tagValues(voice, 'Source')]
    .flatMap((value) => Array.isArray(value) ? value : value ? [value] : [])
    .join(' ')
    .toLowerCase();
  return (!query || searchable.includes(query))
    && (!filters.locale || voice.Locale === filters.locale)
    && (!filters.gender || voice.Gender === filters.gender)
    && (!filters.type || voice.VoiceType === filters.type)
    && hasValue(voice.RolePlayList, filters.role)
    && (!filters.status || voice.Status === filters.status)
    && hasValue(tagValues(voice, 'TailoredScenarios'), filters.scenario)
    && hasValue(tagValues(voice, 'VoicePersonalities'), filters.personality)
    && hasValue(tagValues(voice, 'ModelSeries'), filters.model)
    && hasValue(tagValues(voice, 'Source'), filters.source)
    && (!filters.styleOnly || Boolean(voice.StyleList?.length));
});
