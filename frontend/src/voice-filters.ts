import type { Voice } from './types/api';

export const localeNames: Record<string, string> = { 'zh-CN': '中文（普通话）', 'zh-TW': '中文（繁体）', 'en-US': '英语（美国）', 'en-GB': '英语（英国）', 'ja-JP': '日语', 'ko-KR': '韩语' };
export const roleLabels: Record<string, string> = { Boy: '男孩', Girl: '女孩', YoungAdultMale: '青年男性', YoungAdultFemale: '青年女性', OlderAdultMale: '中老年男性', OlderAdultFemale: '中老年女性', SeniorMale: '老年男性', SeniorFemale: '老年女性', Narrator: '旁白' };
export const typeLabels: Record<string, string> = { Neural: '神经网络', Standard: '标准', OnlineNatural: '自然语音' };
export const statusLabels: Record<string, string> = { GA: '正式版', Preview: '预览版', Deprecated: '已弃用' };
export const scenarioLabels: Record<string, string> = { advertisement: '广告', assistant: '语音助手', audiobook: '有声书', audiobooks: '有声书', chat: '聊天对话', 'customer service': '客户服务', documentary: '纪录片', 'e-learning': '在线学习', gaming: '游戏', learning: '学习', meditation: '冥想', narration: '旁白', news: '新闻播报', podcast: '播客', 'social media': '社交媒体', story: '故事讲述', 'call center': '呼叫中心', conversation: '对话' };
export const personalityLabels: Record<string, string> = {
  animated: '生动', approachable: '平易近人', authentic: '真诚自然', authoritative: '权威',
  bright: '明亮', calm: '平静', caring: '关怀', casual: '轻松', cheerful: '开朗', clear: '清晰',
  confident: '自信', crisp: '清脆', curious: '好奇', deep: '深沉', emotional: '富有情感',
  empathetic: '善解人意', engaging: '吸引人', expressive: '富有表现力', formal: '正式',
  friendly: '友好', gentle: '温和', hoarse: '沙哑', honest: '诚实', knowledgable: '博学',
  'light-hearted': '轻松愉快', mature: '成熟', pleasant: '悦耳', polite: '礼貌',
  professional: '专业', resonant: '浑厚', serious: '严肃', shy: '害羞', sincere: '真挚',
  smooth: '圆润', soft: '柔和', soothing: '舒缓', strong: '有力量', thoughtful: '体贴',
  trusthworthy: '值得信赖', upbeat: '积极', versatile: '多变', warm: '温暖',
  'well-rounded': '全面均衡', whimsical: '奇思妙想', youthful: '青春',
};

export const styleLabels: Record<string, string> = {
  adventurous: '冒险', 'advertisement-upbeat': '活力广告', affectionate: '亲切', anger: '愤怒',
  angry: '生气', anxious: '焦虑', assassin: '刺客', assistant: '助手', callcenter: '呼叫中心',
  calm: '平静', captain: '船长', caringempathy: '关怀同理', cavalier: '骑士', chat: '聊天',
  'chat-casual': '轻松聊天', cheerful: '开朗', comforting: '安慰', complaining: '抱怨',
  confused: '困惑', confusion: '困惑', conversation: '对话', curious: '好奇',
  'customer-service': '客户服务', customerservice: '客户服务', cute: '可爱', cutesy: '俏皮可爱',
  debating: '辩论', depressed: '沮丧', determination: '坚定', determined: '坚定',
  disappointed: '失望', disgruntled: '不满', disgust: '厌恶', disgusted: '厌恶',
  'documentary-narration': '纪录片旁白', embarrassed: '尴尬', embarrassment: '尴尬',
  empathetic: '富有同理心', encouraging: '鼓励', envious: '羡慕', excited: '兴奋',
  excitement: '兴奋', fear: '害怕', fearful: '害怕', friendly: '友好',
  friendlycheerful: '友好开朗', funny: '幽默', 'game-narrator': '游戏旁白',
  generalconversation: '日常对话', gentle: '温和', geomancer: '地卜师', guilty: '内疚',
  happiness: '快乐', happy: '开心', hope: '希望', hopeful: '充满希望', jealous: '嫉妒',
  jealousy: '嫉妒', joy: '喜悦', joyful: '喜悦', learning: '学习', 'live-commercial': '直播广告',
  livecommercial: '直播广告', lonely: '孤独', lyrical: '抒情', media: '媒体', narration: '旁白',
  'narration-professional': '专业旁白', 'narration-relaxed': '轻松旁白', nervous: '紧张', neutral: '中性',
  news: '新闻', newscast: '新闻播报', 'newscast-casual': '轻松新闻播报',
  'newscast-formal': '正式新闻播报', nostalgic: '怀旧', persuasive: '有说服力', poet: '诗人',
  'poetry-reading': '诗歌朗读', prince: '王子', professional: '专业', reflective: '沉思',
  regret: '后悔', regretful: '后悔', relief: '如释重负', relieved: '释然', sad: '悲伤',
  saddisappointed: '悲伤失望', sadness: '悲伤', sales: '销售', sentimental: '感性',
  serious: '严肃', shouting: '喊叫', shy: '害羞', softvoice: '轻柔', sorry: '抱歉',
  'sports-commentary': '体育解说', 'sports-commentary-excited': '激情体育解说', story: '故事',
  'story-telling': '故事讲述', strict: '严厉', surprise: '惊讶', surprised: '惊喜',
  terrified: '恐惧', tired: '疲惫', unfriendly: '不友好', 'voice-assistant': '语音助手', whispering: '耳语',
};

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
