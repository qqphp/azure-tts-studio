import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { xml } from '@codemirror/lang-xml';
import CodeMirror from '@uiw/react-codemirror';
import {
  AudioLines,
  AudioWaveform,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  FileCode2,
  Gauge,
  Heart,
  LoaderCircle,
  Languages,
  Music2,
  Pencil,
  Play,
  Plus,
  Pause,
  RotateCcw,
  Search,
  Timer,
  Trash2,
  Users,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';
import { usePlayerStore } from '../stores/player-store';
import type { BackgroundMusic, EditorRole, Voice } from '../types/api';

type EditorSegment = {
  id: string;
  roleId?: number;
  name: string;
  voice: string;
  style: string;
  role: string;
  rate: string;
  audioDuration?: string;
  text: string;
};

type SsmlTool = {
  label: string;
  hint: string;
  open?: string;
  close?: string;
  insert?: string;
};

type BackgroundAudioSelection = {
  music: BackgroundMusic;
  volume: string;
  fadeIn: string;
  fadeOut: string;
};

type BreakStrength = 'x-weak' | 'weak' | 'medium' | 'strong' | 'x-strong';

const ssmlToolGroups: { label: string; tools: SsmlTool[] }[] = [
  { label: '情感', tools: [] },
  { label: '副语言', tools: [] },
  { label: '角色', tools: [] },
  { label: '语速', tools: [] },
  { label: '停顿', tools: [] },
  { label: '时长', tools: [] },
  { label: '韵律', tools: [] },
  { label: '静音', tools: [] },
  { label: '音效', tools: [] },
  { label: '背景音', tools: [] },
];

const ssmlToolIcons = [Heart, Languages, Users, Gauge, Pause, Timer, AudioWaveform, VolumeX, AudioLines, Music2];

const starterSegments: EditorSegment[] = [
  {
    id: 'segment-1',
    name: '旁白',
    voice: 'zh-CN-XiaoxiaoNeural',
    style: 'cheerful',
    role: '',
    rate: 'medium',
    text: '欢迎使用专业多角色配音工作室，在这里编排每一句台词。',
  },
  {
    id: 'segment-2',
    name: '角色 2',
    voice: 'zh-CN-YunxiNeural',
    style: '',
    role: '',
    rate: 'medium',
    text: '为不同角色选择音色与表达方式，一次生成完整、自然的音频。',
  },
];

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const escapeXmlText = (value: string) => value
  .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\dA-Fa-f]+);)/g, '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

// Escape regular text while keeping the SSML elements inserted by the visual tools intact.
const escapeSsmlContent = (value: string) => value
  .split(/(<[^>]+>)/g)
  .map((part) => part.startsWith('<') && part.endsWith('>') ? part : escapeXmlText(part))
  .join('');

const boundedNumber = (value: string, minimum: number, maximum: number, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

const buildSsml = (segments: EditorSegment[], backgroundAudio?: BackgroundAudioSelection | null) => {
  const content = segments
    .filter((segment) => segment.text.trim())
    .map((segment) => {
      const expressionAttributes = [
        segment.style ? `style="${escapeXml(segment.style)}"` : '',
        segment.role ? `role="${escapeXml(segment.role)}"` : '',
      ].filter(Boolean).join(' ');
      // 片段编辑器允许用户通过可视化工具插入 SSML，因此这里保留片段中的 XML 标记。
      const text = `<prosody rate="${escapeXml(segment.rate)}">${escapeSsmlContent(segment.text.trim())}</prosody>`;
      const expression = expressionAttributes ? `<mstts:express-as ${expressionAttributes}>${text}</mstts:express-as>` : text;
      const audioDuration = segment.audioDuration
        ? `<mstts:audioduration value="${escapeXml(segment.audioDuration)}"/>\n    `
        : '';
      return `  <voice name="${escapeXml(segment.voice)}">\n    ${audioDuration}${expression}\n  </voice>`;
    })
    .join('\n');

  const background = backgroundAudio
    ? `  <mstts:backgroundaudio src="${escapeXml(backgroundAudio.music.url)}" volume="${boundedNumber(backgroundAudio.volume, 0, 100, 1)}" fadein="${Math.round(boundedNumber(backgroundAudio.fadeIn, 0, 10000, 0))}" fadeout="${Math.round(boundedNumber(backgroundAudio.fadeOut, 0, 10000, 0))}"/>\n`
    : '';
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">\n${background}${content}\n</speak>`;
};

const voiceName = (voice: Voice | undefined, fallback: string) => voice?.LocalName || voice?.DisplayName || fallback;
const comparableVoiceId = (value: string) => value.replaceAll(':', '').toLowerCase();
const resolveSavedVoice = (savedVoice: Voice, voices: Voice[]) => voices.find((voice) => voice.ShortName === savedVoice.ShortName)
  ?? voices.find((voice) => comparableVoiceId(voice.ShortName) === comparableVoiceId(savedVoice.ShortName))
  ?? savedVoice;
const rateLabels: Record<string, string> = {
  'x-slow': 'x-slow · 0.5x',
  slow: 'slow · 0.64x',
  medium: 'medium · 1.0x',
  fast: 'fast · 1.55x',
  'x-fast': 'x-fast · 2.0x',
};

export function EditorPage() {
  const client = useQueryClient();
  const setTrack = usePlayerStore((state) => state.setTrack);
  const { data: voices = [] } = useQuery({ queryKey: ['voices'], queryFn: api.voices });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const { data: favoriteVoices = [], isLoading: favoritesLoading } = useQuery({ queryKey: ['voice-favorite-items'], queryFn: api.favoriteVoiceItems });
  const { data: savedRoles = [], isLoading: rolesLoading } = useQuery({ queryKey: ['editor-roles'], queryFn: api.editorRoles });
  const { data: backgroundMusic = [], isLoading: backgroundMusicLoading } = useQuery({ queryKey: ['background-music'], queryFn: api.backgroundMusic });
  const { data: soundEffects = [], isLoading: soundEffectsLoading } = useQuery({ queryKey: ['sound-effects'], queryFn: api.soundEffects });
  const [segments, setSegments] = useState<EditorSegment[]>(starterSegments);
  const [activeSegmentId, setActiveSegmentId] = useState(starterSegments[0].id);
  const [view, setView] = useState<'visual' | 'source'>('visual');
  const [source, setSource] = useState(() => buildSsml(starterSegments));
  const [message, setMessage] = useState('');
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleKeyword, setRoleKeyword] = useState('');
  const [roleTab, setRoleTab] = useState<'all' | 'favorites'>('all');
  const [selectedRoleVoice, setSelectedRoleVoice] = useState<Voice | null>(null);
  const [roleDialogError, setRoleDialogError] = useState('');
  const [editingRole, setEditingRole] = useState<EditorRole | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleRate, setEditRoleRate] = useState('medium');
  const [editRoleError, setEditRoleError] = useState('');
  const [openSsmlMenu, setOpenSsmlMenu] = useState<string | null>(null);
  const [backgroundDialogOpen, setBackgroundDialogOpen] = useState(false);
  const [backgroundKeyword, setBackgroundKeyword] = useState('');
  const [backgroundCategory, setBackgroundCategory] = useState('');
  const [backgroundTag, setBackgroundTag] = useState('');
  const [backgroundAudio, setBackgroundAudio] = useState<BackgroundAudioSelection | null>(null);
  const [backgroundDraft, setBackgroundDraft] = useState<{ musicId: number | null; volume: string; fadeIn: string; fadeOut: string }>({ musicId: null, volume: '1', fadeIn: '0', fadeOut: '0' });
  const [soundEffectDialogOpen, setSoundEffectDialogOpen] = useState(false);
  const [soundEffectKeyword, setSoundEffectKeyword] = useState('');
  const [soundEffectCategory, setSoundEffectCategory] = useState('');
  const [soundEffectTag, setSoundEffectTag] = useState('');
  const [soundEffectDraftId, setSoundEffectDraftId] = useState<number | null>(null);
  const [soundEffectFallback, setSoundEffectFallback] = useState('');
  const [breakMode, setBreakMode] = useState<'strength' | 'time'>('strength');
  const [breakStrength, setBreakStrength] = useState<BreakStrength>('medium');
  const [breakTime, setBreakTime] = useState('750');
  const [audioDurationValue, setAudioDurationValue] = useState('2');
  const [audioDurationUnit, setAudioDurationUnit] = useState<'s' | 'ms'>('s');
  const [prosodyPitch, setProsodyPitch] = useState('');
  const [prosodyRange, setProsodyRange] = useState('');
  const [prosodyRate, setProsodyRate] = useState('');
  const [prosodyVolume, setProsodyVolume] = useState('');
  const [prosodyContour, setProsodyContour] = useState('');
  const hydrated = useRef(false);
  const repairingRoleIds = useRef(new Set<number>());
  const segmentSelections = useRef(new Map<string, { from: number; to: number }>());
  const ssmlToolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (!ssmlToolbarRef.current?.contains(event.target as Node)) setOpenSsmlMenu(null);
    };
    const closeMenuWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenSsmlMenu(null);
    };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeMenuWithKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeMenuWithKeyboard);
    };
  }, []);

  useEffect(() => {
    if (!voices.length || hydrated.current) return;
    hydrated.current = true;
    const preferred = voices.find((voice) => voice.ShortName === settings?.defaultVoice) ?? voices[0];
    const alternate = voices.find((voice) => voice.ShortName !== preferred.ShortName && voice.Gender !== preferred.Gender)
      ?? voices.find((voice) => voice.ShortName !== preferred.ShortName)
      ?? preferred;
    setSegments((current) => current.map((segment, index) => ({
      ...segment,
      voice: index === 0 ? preferred.ShortName : alternate.ShortName,
      style: index === 0 && preferred.StyleList?.includes(segment.style) ? segment.style : '',
    })));
  }, [settings?.defaultVoice, voices]);

  useEffect(() => {
    if (!voices.length || !savedRoles.length) return;
    const repairs = savedRoles.flatMap((role) => {
      if (voices.some((voice) => voice.ShortName === role.voice.ShortName) || repairingRoleIds.current.has(role.id)) return [];
      const canonicalVoice = voices.find((voice) => comparableVoiceId(voice.ShortName) === comparableVoiceId(role.voice.ShortName));
      if (!canonicalVoice) return [];
      repairingRoleIds.current.add(role.id);
      return [{ role, voice: canonicalVoice }];
    });
    if (!repairs.length) return;
    Promise.all(repairs.map(({ role, voice }) => api.updateEditorRole(role.id, { name: role.name, rate: role.rate, voice })))
      .then(() => client.invalidateQueries({ queryKey: ['editor-roles'] }))
      .catch(() => repairs.forEach(({ role }) => repairingRoleIds.current.delete(role.id)));
  }, [client, savedRoles, voices]);

  useEffect(() => {
    if (!savedRoles.length) return;
    setSegments((current) => current.map((segment) => {
      const savedRole = segment.roleId
        ? savedRoles.find((role) => role.id === segment.roleId)
        : savedRoles.find((role) => role.name === segment.name);
      if (!savedRole || (segment.roleId === savedRole.id && segment.name === savedRole.name)) return segment;
      return { ...segment, roleId: savedRole.id, name: savedRole.name };
    }));
  }, [savedRoles]);

  const compiledSsml = useMemo(() => buildSsml(segments, backgroundAudio), [backgroundAudio, segments]);
  const activeSegment = segments.find((segment) => segment.id === activeSegmentId) ?? segments[0];
  const activeSsml = view === 'source' ? source : compiledSsml;
  const totalCharacters = useMemo(() => segments.reduce((total, segment) => total + segment.text.length, 0), [segments]);
  const favoriteVoiceSet = useMemo(() => new Set(favoriteVoices.map((voice) => voice.ShortName)), [favoriteVoices]);
  const roleVoiceSource = roleTab === 'favorites' ? favoriteVoices : voices;
  const roleVoiceResults = useMemo(() => {
    const keyword = roleKeyword.trim().toLowerCase();
    if (!keyword) return roleVoiceSource;
    return roleVoiceSource.filter((voice) => `${voice.ShortName} ${voice.LocalName ?? ''} ${voice.DisplayName ?? ''} ${voice.LocaleName ?? ''} ${voice.Locale ?? ''}`.toLowerCase().includes(keyword));
  }, [roleKeyword, roleVoiceSource]);
  const backgroundCategories = useMemo(() => [...new Set(backgroundMusic.map((music) => music.category))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [backgroundMusic]);
  const backgroundTags = useMemo(() => [...new Set(backgroundMusic.flatMap((music) => music.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [backgroundMusic]);
  const backgroundResults = useMemo(() => {
    const keyword = backgroundKeyword.trim().toLowerCase();
    return backgroundMusic.filter((music) => {
      const matchesKeyword = !keyword || `${music.title} ${music.category} ${music.tags.join(' ')} ${music.url}`.toLowerCase().includes(keyword);
      return matchesKeyword && (!backgroundCategory || music.category === backgroundCategory) && (!backgroundTag || music.tags.includes(backgroundTag));
    });
  }, [backgroundCategory, backgroundKeyword, backgroundMusic, backgroundTag]);
  const soundEffectCategories = useMemo(() => [...new Set(soundEffects.map((effect) => effect.category))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [soundEffects]);
  const soundEffectTags = useMemo(() => [...new Set(soundEffects.flatMap((effect) => effect.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [soundEffects]);
  const soundEffectResults = useMemo(() => {
    const keyword = soundEffectKeyword.trim().toLowerCase();
    return soundEffects.filter((effect) => {
      const matchesKeyword = !keyword || `${effect.title} ${effect.category} ${effect.tags.join(' ')} ${effect.url}`.toLowerCase().includes(keyword);
      return matchesKeyword && (!soundEffectCategory || effect.category === soundEffectCategory) && (!soundEffectTag || effect.tags.includes(soundEffectTag));
    });
  }, [soundEffectCategory, soundEffectKeyword, soundEffects, soundEffectTag]);

  const validate = useMutation({
    mutationFn: api.validateSsml,
    onSuccess: (result) => setMessage(`结构校验通过：${result.voiceCount} 个音色，${result.textLength} 个文本字符。`),
    onError: (cause) => setMessage(cause instanceof Error ? cause.message : 'SSML 校验失败'),
  });
  const synthesize = useMutation({
    mutationFn: api.speakSsml,
    onSuccess: (result) => {
      setTrack(`/api/history/${result.id}`, result.meta.voice || '专业配音');
      client.invalidateQueries({ queryKey: ['history'] });
      setMessage('完整配音已生成，正在播放。');
    },
    onError: (cause) => setMessage(cause instanceof Error ? cause.message : '生成失败'),
  });
  const createRole = useMutation({
    mutationFn: api.createEditorRole,
    onSuccess: (role) => {
      client.invalidateQueries({ queryKey: ['editor-roles'] });
      const segmentId = `segment-${Date.now()}`;
      setSegments((current) => [...current, {
        id: segmentId,
        roleId: role.id,
        name: role.name,
        voice: role.voice.ShortName,
        style: '',
        role: '',
        rate: role.rate || 'medium',
        text: '',
      }]);
      setActiveSegmentId(segmentId);
      setRoleDialogOpen(false);
      setMessage(`角色“${role.name}”已保存，并添加到配音编排。`);
    },
    onError: (cause) => setRoleDialogError(cause instanceof Error ? cause.message : '角色保存失败'),
  });
  const updateRole = useMutation({
    mutationFn: ({ id, name, rate }: { id: number; name: string; rate: string }) => api.updateEditorRole(id, { name, rate }),
    onSuccess: (role) => {
      client.invalidateQueries({ queryKey: ['editor-roles'] });
      setSegments((current) => current.map((segment) => segment.roleId === role.id
        ? { ...segment, name: role.name, rate: role.rate || segment.rate }
        : segment));
      setEditingRole(null);
      setMessage(`角色“${role.name}”已更新，默认语速为 ${rateLabels[role.rate] || role.rate}。`);
    },
    onError: (cause) => setEditRoleError(cause instanceof Error ? cause.message : '角色更新失败'),
  });
  const deleteRole = useMutation({
    mutationFn: api.deleteEditorRole,
    onSuccess: (_, roleId) => {
      const removedRole = savedRoles.find((role) => role.id === roleId);
      client.invalidateQueries({ queryKey: ['editor-roles'] });
      setMessage(removedRole ? `角色“${removedRole.name}”已删除，已有配音片段不受影响。` : '角色已删除。');
    },
    onError: (cause) => setMessage(cause instanceof Error ? cause.message : '角色删除失败'),
  });

  const updateSegment = (id: string, patch: Partial<EditorSegment>) => {
    setSegments((current) => current.map((segment) => segment.id === id ? { ...segment, ...patch } : segment));
  };

  const selectSegmentRole = (segmentId: string, roleId: string) => {
    const selectedRole = savedRoles.find((role) => role.id === Number(roleId));
    if (!selectedRole) return;
    const roleVoice = resolveSavedVoice(selectedRole.voice, voices);
    updateSegment(segmentId, {
      roleId: selectedRole.id,
      name: selectedRole.name,
      voice: roleVoice.ShortName,
      rate: selectedRole.rate || 'medium',
      style: '',
      role: '',
    });
  };

  const insertSsml = (tool: SsmlTool) => {
    const segment = activeSegment;
    if (!segment) return;
    const selection = segmentSelections.current.get(segment.id) ?? { from: segment.text.length, to: segment.text.length };
    const start = Math.max(0, Math.min(selection.from, segment.text.length));
    const end = Math.max(start, Math.min(selection.to, segment.text.length));
    const selected = segment.text.slice(start, end) || '要调整的内容';
    const replacement = tool.insert ?? `${tool.open ?? ''}${selected}${tool.close ?? ''}`;
    const nextText = `${segment.text.slice(0, start)}${replacement}${segment.text.slice(end)}`;
    segmentSelections.current.set(segment.id, { from: start, to: start + replacement.length });
    updateSegment(segment.id, { text: nextText });
    setMessage(`已插入「${tool.label}」标记。可在编辑区直接修改属性值。`);
  };

  const insertBreak = () => {
    const segment = activeSegment;
    if (!segment) return;
    const selection = segmentSelections.current.get(segment.id) ?? { from: segment.text.length, to: segment.text.length };
    const insertAt = Math.max(0, Math.min(selection.from, segment.text.length));
    const milliseconds = Math.round(boundedNumber(breakTime, 0, 20000, 750));
    const replacement = breakMode === 'time' ? `<break time="${milliseconds}ms"/>` : `<break strength="${breakStrength}"/>`;
    const nextText = `${segment.text.slice(0, insertAt)}${replacement}${segment.text.slice(insertAt)}`;
    segmentSelections.current.set(segment.id, { from: insertAt + replacement.length, to: insertAt + replacement.length });
    updateSegment(segment.id, { text: nextText });
    setOpenSsmlMenu(null);
    setMessage(breakMode === 'time' ? `已插入 ${milliseconds}ms 停顿。` : `已插入 ${breakStrength} 强度停顿。`);
  };

  const openAudioDurationMenu = () => {
    if (openSsmlMenu === '时长') {
      setOpenSsmlMenu(null);
      return;
    }
    const currentValue = activeSegment?.audioDuration?.match(/^([0-9]+(?:\.[0-9]+)?)(ms|s)$/);
    setAudioDurationValue(currentValue?.[1] ?? '2');
    setAudioDurationUnit(currentValue?.[2] === 'ms' ? 'ms' : 's');
    setOpenSsmlMenu('时长');
  };

  const applyAudioDuration = () => {
    const segment = activeSegment;
    if (!segment || !audioDurationValue.trim()) return;
    const isMilliseconds = audioDurationUnit === 'ms';
    const maximum = isMilliseconds ? 300000 : 300;
    const minimum = isMilliseconds ? 1 : 0.001;
    const fallback = isMilliseconds ? 2000 : 2;
    const bounded = boundedNumber(audioDurationValue, minimum, maximum, fallback);
    const normalized = isMilliseconds ? Math.round(bounded) : Math.round(bounded * 1000) / 1000;
    const duration = `${normalized}${audioDurationUnit}`;
    updateSegment(segment.id, { audioDuration: duration });
    setAudioDurationValue(String(normalized));
    setOpenSsmlMenu(null);
    setMessage(`已将片段“${segment.name || '未命名角色'}”的输出时长设置为 ${duration}。`);
  };

  const clearAudioDuration = () => {
    const segment = activeSegment;
    if (!segment?.audioDuration) return;
    updateSegment(segment.id, { audioDuration: undefined });
    setOpenSsmlMenu(null);
    setMessage(`已清除片段“${segment.name || '未命名角色'}”的输出时长设置。`);
  };

  const insertProsody = () => {
    const segment = activeSegment;
    if (!segment) return;
    const attributes = [
      ['pitch', prosodyPitch],
      ['range', prosodyRange],
      ['rate', prosodyRate],
      ['volume', prosodyVolume],
      ['contour', prosodyContour],
    ].filter(([, value]) => value.trim()).map(([name, value]) => `${name}="${escapeXml(value.trim())}"`);
    if (!attributes.length) return;
    const selection = segmentSelections.current.get(segment.id) ?? { from: segment.text.length, to: segment.text.length };
    const start = Math.max(0, Math.min(selection.from, segment.text.length));
    const end = Math.max(start, Math.min(selection.to, segment.text.length));
    const selected = segment.text.slice(start, end) || '要调整的内容';
    const replacement = `<prosody ${attributes.join(' ')}>${selected}</prosody>`;
    const nextText = `${segment.text.slice(0, start)}${replacement}${segment.text.slice(end)}`;
    segmentSelections.current.set(segment.id, { from: start, to: start + replacement.length });
    updateSegment(segment.id, { text: nextText });
    setOpenSsmlMenu(null);
    setMessage(`已插入韵律标记：${attributes.map((attribute) => attribute.split('=')[0]).join('、')}。`);
  };

  const addSegment = () => {
    const initialRole = savedRoles[0];
    const initialVoice = initialRole ? resolveSavedVoice(initialRole.voice, voices).ShortName : settings?.defaultVoice || voices[0]?.ShortName || 'zh-CN-XiaoxiaoNeural';
    const id = `segment-${Date.now()}`;
    setSegments((current) => [...current, {
      id,
      roleId: initialRole?.id,
      name: initialRole?.name || '',
      voice: initialVoice,
      style: '',
      role: '',
      rate: initialRole?.rate || 'medium',
      text: '',
    }]);
    setActiveSegmentId(id);
  };

  const addRoleSegment = (role: EditorRole) => {
    const roleVoice = resolveSavedVoice(role.voice, voices);
    const id = `segment-${Date.now()}`;
    setSegments((current) => [...current, {
      id,
      roleId: role.id,
      name: role.name,
      voice: roleVoice.ShortName,
      style: '',
      role: '',
      rate: role.rate || 'medium',
      text: '',
    }]);
    setActiveSegmentId(id);
    setMessage(`已使用角色“${role.name}”添加配音片段。`);
  };

  const openRoleDialog = () => {
    const initialVoice = voices.find((voice) => voice.ShortName === settings?.defaultVoice) ?? voices[0] ?? favoriteVoices[0] ?? null;
    setRoleName('');
    setRoleKeyword('');
    setRoleTab('all');
    setSelectedRoleVoice(initialVoice);
    setRoleDialogError('');
    setRoleDialogOpen(true);
  };

  const confirmRole = () => {
    const name = roleName.trim();
    if (!name) {
      setRoleDialogError('请输入角色名');
      return;
    }
    if (!selectedRoleVoice) {
      setRoleDialogError('请选择一个音色');
      return;
    }
    setRoleDialogError('');
    createRole.mutate({ name, voice: selectedRoleVoice });
  };

  const openEditRole = (role: EditorRole) => {
    setEditingRole(role);
    setEditRoleName(role.name);
    setEditRoleRate(role.rate || 'medium');
    setEditRoleError('');
  };

  const confirmEditRole = () => {
    const name = editRoleName.trim();
    if (!name) {
      setEditRoleError('请输入角色名');
      return;
    }
    if (!editingRole) return;
    setEditRoleError('');
    updateRole.mutate({ id: editingRole.id, name, rate: editRoleRate });
  };

  const removeSavedRole = (role: EditorRole) => {
    if (!window.confirm(`确定删除角色“${role.name}”吗？\n删除后，已经添加到编排中的配音片段不会受到影响。`)) return;
    deleteRole.mutate(role.id);
  };

  const duplicateSegment = (segment: EditorSegment) => {
    setSegments((current) => {
      const index = current.findIndex((item) => item.id === segment.id);
      const next = [...current];
      next.splice(index + 1, 0, { ...segment, id: `segment-${Date.now()}`, name: `${segment.name} 副本` });
      return next;
    });
  };

  const removeSegment = (segment: EditorSegment) => {
    if (!window.confirm(`确定删除片段“${segment.name || '未命名角色'}”吗？\n删除后该片段的配音内容将无法恢复。`)) return;
    setSegments((current) => {
      const next = current.filter((item) => item.id !== segment.id);
      if (activeSegmentId === segment.id) setActiveSegmentId(next[0]?.id ?? '');
      return next;
    });
  };

  const switchView = () => {
    if (view === 'visual') setSource(compiledSsml);
    setView((current) => current === 'visual' ? 'source' : 'visual');
    setMessage('');
  };

  const openBackgroundDialog = () => {
    setOpenSsmlMenu(null);
    setBackgroundKeyword('');
    setBackgroundCategory('');
    setBackgroundTag('');
    setBackgroundDraft(backgroundAudio
      ? { musicId: backgroundAudio.music.id, volume: backgroundAudio.volume, fadeIn: backgroundAudio.fadeIn, fadeOut: backgroundAudio.fadeOut }
      : { musicId: null, volume: '1', fadeIn: '0', fadeOut: '0' });
    setBackgroundDialogOpen(true);
  };

  const openSoundEffectDialog = () => {
    if (!activeSegment) return;
    const selection = segmentSelections.current.get(activeSegment.id) ?? { from: activeSegment.text.length, to: activeSegment.text.length };
    const selectedText = activeSegment.text.slice(selection.from, selection.to);
    setOpenSsmlMenu(null);
    setSoundEffectKeyword('');
    setSoundEffectCategory('');
    setSoundEffectTag('');
    setSoundEffectDraftId(null);
    setSoundEffectFallback(selectedText);
    setSoundEffectDialogOpen(true);
  };

  const confirmSoundEffect = () => {
    const effect = soundEffects.find((item) => item.id === soundEffectDraftId);
    const segment = activeSegment;
    if (!effect || !segment) return;
    const selection = segmentSelections.current.get(segment.id) ?? { from: segment.text.length, to: segment.text.length };
    const start = Math.max(0, Math.min(selection.from, segment.text.length));
    const end = Math.max(start, Math.min(selection.to, segment.text.length));
    const fallback = soundEffectFallback.trim();
    const replacement = fallback
      ? `<audio src="${escapeXml(effect.url)}">${escapeXml(fallback)}</audio>`
      : `<audio src="${escapeXml(effect.url)}"/>`;
    const nextText = `${segment.text.slice(0, start)}${replacement}${segment.text.slice(end)}`;
    segmentSelections.current.set(segment.id, { from: start, to: start + replacement.length });
    updateSegment(segment.id, { text: nextText });
    setSoundEffectDialogOpen(false);
    setMessage(`已将音效“${effect.title}”插入片段“${segment.name || '未命名片段'}”。`);
  };

  const confirmBackgroundAudio = () => {
    const music = backgroundMusic.find((item) => item.id === backgroundDraft.musicId);
    if (!music) return;
    setBackgroundAudio({ music, volume: backgroundDraft.volume, fadeIn: backgroundDraft.fadeIn, fadeOut: backgroundDraft.fadeOut });
    setBackgroundDialogOpen(false);
    setMessage(`已选择背景音乐“${music.title}”，查看 SSML 源码或生成配音时会自动加入。`);
  };

  const updateBackgroundAudio = (patch: Partial<Omit<BackgroundAudioSelection, 'music'>>) => {
    setBackgroundAudio((current) => current ? { ...current, ...patch } : current);
  };

  const resetEditor = () => {
    if (!window.confirm('确定恢复为初始编排吗？当前内容将被替换。')) return;
    setSegments(starterSegments);
    setActiveSegmentId(starterSegments[0].id);
    setBackgroundAudio(null);
    setSource(buildSsml(starterSegments));
    setView('visual');
    setMessage('已恢复初始编排。');
  };

  const previewSegment = (segment: EditorSegment) => synthesize.mutate(buildSsml([segment], backgroundAudio));
  const canGenerate = view === 'source' ? source.trim().length > 0 : segments.some((segment) => segment.text.trim());

  return <>
    <PageHeader
      eyebrow="PRODUCTION STUDIO"
      title="专业多角色配音"
      description="分角色编排对白，精细控制音色、说话风格与节奏，一次生成完整音频。"
    />
    <div className="professional-editor">
      <div className="editor-toolbar card">
        <div className="editor-tool-group">
          <button className="editor-tool-button accent" onClick={addSegment}><Plus size={18} /><span>添加片段</span></button>
          <button className="editor-tool-button" onClick={switchView}>{view === 'visual' ? <FileCode2 size={18} /> : <Users size={18} />}<span>{view === 'visual' ? 'SSML 源码' : '可视编排'}</span></button>
          <button className="editor-tool-button" onClick={() => validate.mutate(activeSsml)} disabled={validate.isPending || !canGenerate}>{validate.isPending ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}<span>校验结构</span></button>
          <button className="editor-tool-button" onClick={resetEditor}><RotateCcw size={18} /><span>恢复示例</span></button>
        </div>
        <div className="editor-document-meta"><b>{view === 'visual' ? `${segments.length} 个配音片段` : 'SSML 源码模式'}</b><span>{totalCharacters} 个文本字符</span></div>
      </div>

      <div className="professional-editor-body">
        <section className="editor-workspace card">
          {view === 'visual' && segments.length > 0 && <div className="workspace-ssml-toolbar" aria-label="SSML 可视化标记工具" ref={ssmlToolbarRef}>
            <div className="segment-ssml-tools">
              {ssmlToolGroups.map((group, groupIndex) => {
                const Icon = ssmlToolIcons[groupIndex];
                const isOpen = openSsmlMenu === group.label;
                if (group.label === '停顿') return <div className={`ssml-tool-menu ${isOpen ? 'open' : ''}`} key={group.label}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpenSsmlMenu(isOpen ? null : group.label)}><Icon size={14} /><span>{group.label}</span><ChevronDown size={12} /></button>
                  {isOpen && <div className="ssml-tool-popover break-tool-popover">
                    <div className="break-mode-tabs"><button className={breakMode === 'strength' ? 'active' : ''} onClick={() => setBreakMode('strength')}>相对强度</button><button className={breakMode === 'time' ? 'active' : ''} onClick={() => setBreakMode('time')}>自定义时长</button></div>
                    {breakMode === 'strength' ? <label className="break-tool-field"><span>停顿强度</span><select value={breakStrength} onChange={(event) => setBreakStrength(event.target.value as BreakStrength)}><option value="x-weak">x-weak · 约 250ms</option><option value="weak">weak · 约 500ms</option><option value="medium">medium · 约 750ms</option><option value="strong">strong · 约 1000ms</option><option value="x-strong">x-strong · 约 1250ms</option></select></label> : <label className="break-tool-field"><span>停顿时长 <em>0–20000ms</em></span><div><input type="number" min="0" max="20000" step="50" value={breakTime} onChange={(event) => setBreakTime(event.target.value)} /><small>ms</small></div></label>}
                    <p>{breakMode === 'time' ? '设置绝对时长后，Azure 会忽略强度属性。' : '使用 Azure 定义的相对停顿等级。'}</p>
                    <button className="break-insert-button" onClick={insertBreak}><Pause size={13} />插入停顿</button>
                  </div>}
                </div>;
                if (group.label === '时长') return <div className={`ssml-tool-menu ${isOpen ? 'open' : ''}`} key={group.label}>
                  <button type="button" aria-expanded={isOpen} onClick={openAudioDurationMenu}><Icon size={14} /><span>{group.label}</span><ChevronDown size={12} /></button>
                  {isOpen && <div className="ssml-tool-popover break-tool-popover duration-tool-popover">
                    <div className="prosody-tool-heading"><b>调整当前片段的输出时长</b><small>目标片段：{activeSegment?.name || '未命名片段'}</small></div>
                    <label className="break-tool-field"><span>输出时长 <em>最大 300 秒</em></span><div className="duration-value-control"><input type="number" min={audioDurationUnit === 'ms' ? 1 : 0.001} max={audioDurationUnit === 'ms' ? 300000 : 300} step={audioDurationUnit === 'ms' ? 100 : 0.1} value={audioDurationValue} onChange={(event) => setAudioDurationValue(event.target.value)} /><select value={audioDurationUnit} onChange={(event) => setAudioDurationUnit(event.target.value as 's' | 'ms')} aria-label="时长单位"><option value="s">秒 s</option><option value="ms">毫秒 ms</option></select></div></label>
                    <p><code>mstts:audioduration</code> 会调整当前片段内全部文本，目标时长应为原始音频的 0.5–2 倍。</p>
                    <div className="duration-tool-actions">{activeSegment?.audioDuration && <button className="duration-clear-button" onClick={clearAudioDuration}>清除 {activeSegment.audioDuration}</button>}<button className="break-insert-button" onClick={applyAudioDuration} disabled={!audioDurationValue.trim()}><Timer size={13} />应用时长</button></div>
                  </div>}
                </div>;
                if (group.label === '韵律') {
                  const hasProsodyValue = [prosodyPitch, prosodyRange, prosodyRate, prosodyVolume, prosodyContour].some((value) => value.trim());
                  return <div className={`ssml-tool-menu ${isOpen ? 'open' : ''}`} key={group.label}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpenSsmlMenu(isOpen ? null : group.label)}><Icon size={14} /><span>{group.label}</span><ChevronDown size={12} /></button>
                    {isOpen && <div className="ssml-tool-popover prosody-tool-popover">
                      <div className="prosody-tool-heading"><b>调整所选文字的韵律</b><small>留空的属性不会写入 SSML</small></div>
                      <div className="prosody-tool-grid">
                        <label><span>音高 pitch</span><input list="prosody-pitch-values" value={prosodyPitch} onChange={(event) => setProsodyPitch(event.target.value)} placeholder="例如：high、+20%" /></label>
                        <label><span>音域 range</span><input list="prosody-range-values" value={prosodyRange} onChange={(event) => setProsodyRange(event.target.value)} placeholder="例如：medium、+2st" /></label>
                        <label><span>语速 rate</span><input list="prosody-rate-values" value={prosodyRate} onChange={(event) => setProsodyRate(event.target.value)} placeholder="例如：fast、+30%" /></label>
                        <label><span>音量 volume</span><input list="prosody-volume-values" value={prosodyVolume} onChange={(event) => setProsodyVolume(event.target.value)} placeholder="例如：loud、+20%" /></label>
                        <label className="prosody-contour-field"><span>音高轮廓 contour</span><input value={prosodyContour} onChange={(event) => setProsodyContour(event.target.value)} placeholder="例如：(0%,+20Hz) (10%,-2st) (40%,+10Hz)" /></label>
                      </div>
                      <datalist id="prosody-pitch-values"><option value="x-low" /><option value="low" /><option value="medium" label="默认值" /><option value="high" /><option value="x-high" /><option value="+20%" /><option value="-20%" /><option value="+80Hz" /><option value="-2st" /></datalist>
                      <datalist id="prosody-range-values"><option value="x-low" /><option value="low" /><option value="medium" label="默认值" /><option value="high" /><option value="x-high" /><option value="+20%" /><option value="+2st" /></datalist>
                      <datalist id="prosody-rate-values"><option value="x-slow" /><option value="slow" /><option value="medium" label="默认值（1.0x）" /><option value="fast" /><option value="x-fast" /><option value="0.5" /><option value="1" /><option value="2" /><option value="+30%" /></datalist>
                      <datalist id="prosody-volume-values"><option value="silent" /><option value="x-soft" /><option value="soft" /><option value="medium" /><option value="loud" /><option value="x-loud" label="默认值（100）" /><option value="75" /><option value="+20%" /></datalist>
                      <p>音高轮廓更适合完整句子或较长短语，单个词可能不会生效。</p>
                      <button className="prosody-insert-button" onClick={insertProsody} disabled={!hasProsodyValue}><AudioWaveform size={13} />应用韵律</button>
                    </div>}
                  </div>;
                }
                if (group.label === '音效') return <div className="ssml-tool-menu" key={group.label}>
                  <button type="button" aria-haspopup="dialog" onClick={openSoundEffectDialog}><Icon size={14} /><span>{group.label}</span></button>
                </div>;
                if (group.label === '背景音') return <div className="ssml-tool-menu" key={group.label}>
                  <button type="button" aria-haspopup="dialog" onClick={openBackgroundDialog}><Icon size={14} /><span>{group.label}</span></button>
                </div>;
                return <div className={`ssml-tool-menu ${isOpen ? 'open' : ''}`} key={group.label}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpenSsmlMenu(isOpen ? null : group.label)}><Icon size={14} /><span>{group.label}</span><ChevronDown size={12} /></button>
                  {isOpen && <div className="ssml-tool-popover">{group.tools.length
                    ? group.tools.map((tool) => <button key={tool.label} title={tool.hint} onClick={() => { insertSsml(tool); setOpenSsmlMenu(null); }}>{tool.label}<small>{tool.hint}</small></button>)
                    : <div className="ssml-tool-empty">暂无可用选项</div>}
                  </div>}
                </div>;
              })}
            </div>
          </div>}
          {view === 'visual' && backgroundAudio && <div className="selected-background-audio" aria-label="已选择的背景音乐">
            <div className="selected-background-main"><span className="selected-background-icon"><Music2 size={16} /></span><span><b title={backgroundAudio.music.title}>{backgroundAudio.music.title}</b><small>{backgroundAudio.music.category}{backgroundAudio.music.tags.length ? ` · ${backgroundAudio.music.tags.join('、')}` : ''}</small></span></div>
            <div className="selected-background-settings">
              <label><span>音量</span><input type="number" min="0" max="100" step="0.1" value={backgroundAudio.volume} onChange={(event) => updateBackgroundAudio({ volume: event.target.value })} /></label>
              <label><span>淡入 ms</span><input type="number" min="0" max="10000" step="100" value={backgroundAudio.fadeIn} onChange={(event) => updateBackgroundAudio({ fadeIn: event.target.value })} /></label>
              <label><span>淡出 ms</span><input type="number" min="0" max="10000" step="100" value={backgroundAudio.fadeOut} onChange={(event) => updateBackgroundAudio({ fadeOut: event.target.value })} /></label>
            </div>
            <div className="selected-background-actions"><button className="icon-button" title="试听背景音乐" onClick={() => setTrack(backgroundAudio.music.url, backgroundAudio.music.title)}><Play size={14} fill="currentColor" /></button><button className="secondary-button" onClick={openBackgroundDialog}>更换</button><button className="icon-button danger" title="移除背景音乐" onClick={() => { setBackgroundAudio(null); setMessage('已移除背景音乐。'); }}><Trash2 size={14} /></button></div>
          </div>}
          {view === 'visual' ? <div className="editor-segment-list">
            {segments.length ? segments.map((segment, index) => {
              const selectedVoice = voices.find((voice) => voice.ShortName === segment.voice);
              return <article className={`editor-segment ${activeSegment?.id === segment.id ? 'active' : ''}`} id={`editor-${segment.id}`} key={segment.id} onFocusCapture={() => setActiveSegmentId(segment.id)} onMouseDown={() => setActiveSegmentId(segment.id)}>
                <div className="segment-controls">
                  <span className="segment-number">{String(index + 1).padStart(2, '0')}</span>
                  <label className="segment-role-name"><span>角色名称</span><select value={segment.roleId ? String(segment.roleId) : ''} onChange={(event) => selectSegmentRole(segment.id, event.target.value)} disabled={rolesLoading || !savedRoles.length}><option value="">{rolesLoading ? '正在读取角色…' : savedRoles.length ? '请选择角色' : '暂无可用角色'}</option>{savedRoles.map((savedRole) => <option key={savedRole.id} value={savedRole.id}>{savedRole.name}</option>)}</select></label>
                  <label><span>音色</span><select value={segment.voice} onChange={(event) => updateSegment(segment.id, { voice: event.target.value, style: '', role: '' })}>{voices.length ? voices.map((voice) => <option key={voice.ShortName} value={voice.ShortName}>{voiceName(voice, voice.ShortName)}</option>) : <option value={segment.voice}>{segment.voice}</option>}</select></label>
                  <label><span>风格</span><select value={segment.style} onChange={(event) => updateSegment(segment.id, { style: event.target.value })}><option value="">默认 · default</option>{selectedVoice?.StyleList?.map((style) => <option key={style} value={style}>{style}</option>)}</select></label>
                  <label><span>角色</span><select value={segment.role} onChange={(event) => updateSegment(segment.id, { role: event.target.value })}><option value="">默认 · default</option>{selectedVoice?.RolePlayList?.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
                  <label className="segment-rate"><span>语速</span><select value={segment.rate} onChange={(event) => updateSegment(segment.id, { rate: event.target.value })}><option value="x-slow">x-slow · 0.5x</option><option value="slow">slow · 0.64x</option><option value="medium">medium · 1.0x</option><option value="fast">fast · 1.55x</option><option value="x-fast">x-fast · 2.0x</option></select></label>
                  <div className="segment-actions">
                    <button className="icon-button" title="试听当前片段" onClick={() => previewSegment(segment)} disabled={!segment.text.trim() || synthesize.isPending}><Play size={15} fill="currentColor" /></button>
                    <button className="icon-button" title="复制片段" onClick={() => duplicateSegment(segment)}><Copy size={15} /></button>
                    <button className="icon-button danger" title="删除片段" onClick={() => removeSegment(segment)}><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="segment-text-wrap">
                  <div className="segment-code-header"><span><Code2 size={14} />片段内容 / SSML</span><span>{(segment.text.match(/<[^>]+>/g) ?? []).length} 个标记 · {segment.text.length} / 1000</span></div>
                  <CodeMirror
                    className="segment-code-editor"
                    value={segment.text}
                    height="118px"
                    extensions={[xml()]}
                    placeholder="输入这个角色要说的内容；选中文字后可使用上方工具插入 SSML 标记……"
                    onChange={(value) => updateSegment(segment.id, { text: value })}
                    onUpdate={(update) => {
                      if (update.selectionSet || update.focusChanged) {
                        const selection = update.state.selection.main;
                        segmentSelections.current.set(segment.id, { from: selection.from, to: selection.to });
                        if (update.view.hasFocus) setActiveSegmentId(segment.id);
                      }
                    }}
                    basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true }}
                  />
                </div>
              </article>;
            }) : <div className="editor-empty"><Users size={30} /><b>还没有配音片段</b><span>点击“添加片段”开始编排。</span><button className="primary-button" onClick={addSegment}><Plus size={16} />添加片段</button></div>}
          </div> : <div className="editor-source-view"><div className="source-view-heading"><div><Code2 size={20} /><span><b>SSML 源码</b><small>可直接编辑 Azure Speech SSML 文档</small></span></div><span className="muted">{source.length} 字符</span></div><CodeMirror className="code-editor" value={source} height="100%" extensions={[xml()]} onChange={setSource} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }} /></div>}

          <footer className="editor-bottom-bar">
            <div><span className={`editor-status ${validate.isError || synthesize.isError ? 'error' : ''}`}>{message || '编排完成后可先校验结构，再生成完整配音。'}</span></div>
            <div className="editor-bottom-actions"><button className="secondary-button" onClick={() => validate.mutate(activeSsml)} disabled={validate.isPending || !canGenerate}><CheckCircle2 size={16} />校验</button><button className="primary-button" onClick={() => synthesize.mutate(activeSsml)} disabled={synthesize.isPending || !canGenerate}>{synthesize.isPending ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />}{synthesize.isPending ? '正在生成…' : '生成完整配音'}</button></div>
          </footer>
        </section>

        <aside className="editor-role-panel card">
          <div className="role-panel-heading"><div><Users size={18} /><span><b>角色列表</b><small>{savedRoles.length} 个已保存角色</small></span></div><button className="icon-button" title="添加角色" onClick={openRoleDialog}><Plus size={16} /></button></div>
          <div className="role-card-list">{rolesLoading ? <p className="role-list-state">正在读取角色…</p> : savedRoles.length ? savedRoles.map((role) => {
            const roleVoice = resolveSavedVoice(role.voice, voices);
            return <article className="editor-role-card" key={role.id}>
              <div className="editor-role-main"><span className="editor-role-avatar">{role.name.trim().slice(0, 1)}</span><span className="editor-role-copy"><b>{role.name}</b><small>{voiceName(roleVoice, roleVoice.ShortName)}</small><em>{rateLabels[role.rate] || rateLabels.medium} · {roleVoice.LocaleName || roleVoice.Locale || roleVoice.ShortName}</em></span></div>
              <div className="editor-role-actions"><button className="role-delete-button" onClick={() => removeSavedRole(role)} disabled={deleteRole.isPending}><Trash2 size={11} />删除</button><button className="role-edit-button" onClick={() => openEditRole(role)} disabled={deleteRole.isPending}><Pencil size={11} />编辑</button><button className="role-locate" onClick={() => addRoleSegment(role)} disabled={deleteRole.isPending}><Plus size={11} />使用</button></div>
            </article>;
          }) : <div className="role-list-empty"><Users size={24} /><b>还没有角色</b><span>点击右上角“+”创建第一个角色。</span></div>}</div>
          <div className="role-panel-tip"><FileCode2 size={17} /><p><b>专业编排提示</b><span>每个片段可独立设置音色、风格、角色和语速，生成时会按列表顺序合成为一段音频。</span></p></div>
        </aside>
      </div>
    </div>
    {soundEffectDialogOpen && <div className="background-audio-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSoundEffectDialogOpen(false); }}>
      <section className="background-audio-dialog sound-effect-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="sound-effect-picker-title">
        <header className="background-audio-dialog-header"><div><span><AudioLines size={20} /></span><div><h2 id="sound-effect-picker-title">插入音效</h2><p>选择录制音频，将其插入当前片段的光标或选区位置。</p></div></div><button className="icon-button" onClick={() => setSoundEffectDialogOpen(false)} aria-label="关闭音效选择"><X size={17} /></button></header>
        <div className="background-audio-filters">
          <div className="background-audio-search"><Search size={16} /><input value={soundEffectKeyword} onChange={(event) => setSoundEffectKeyword(event.target.value)} placeholder="搜索标题、分类、标签或链接" autoFocus /></div>
          <select value={soundEffectCategory} onChange={(event) => setSoundEffectCategory(event.target.value)} aria-label="按音效分类筛选"><option value="">全部分类</option>{soundEffectCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={soundEffectTag} onChange={(event) => setSoundEffectTag(event.target.value)} aria-label="按音效标签筛选"><option value="">全部标签</option>{soundEffectTags.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
        <div className="background-audio-dialog-body sound-effect-picker-body">
          <div className="background-audio-results">{soundEffectsLoading ? <p className="state-message">正在读取音效…</p> : soundEffectResults.length ? soundEffectResults.map((effect) => {
            const selected = soundEffectDraftId === effect.id;
            return <article className={`background-audio-option ${selected ? 'selected' : ''}`} key={effect.id}>
              <button className="background-audio-option-main" onClick={() => setSoundEffectDraftId(effect.id)}><span className="background-audio-option-icon"><AudioLines size={17} /></span><span><b title={effect.title}>{effect.title}</b><small>{effect.category}</small><em>{effect.tags.length ? effect.tags.join(' · ') : '无标签'}</em></span>{selected && <CheckCircle2 size={17} />}</button>
              <button className="icon-button" onClick={() => setTrack(effect.url, effect.title)} title={`试听${effect.title}`}><Play size={14} fill="currentColor" /></button>
            </article>;
          }) : <div className="background-audio-empty"><AudioLines size={28} /><b>{soundEffects.length ? '没有符合筛选条件的音效' : '音效库为空'}</b><span>{soundEffects.length ? '请调整搜索、分类或标签条件。' : '请先前往“音效中心”添加音效。'}</span></div>}</div>
          <aside className="background-audio-options sound-effect-insert-options"><div><b>插入设置</b><small>目标片段：{activeSegment?.name || '未命名片段'}</small></div><label><span>播放失败时朗读的内容 <em>可选</em></span><textarea value={soundEffectFallback} maxLength={500} onChange={(event) => setSoundEffectFallback(event.target.value)} placeholder="音频无法播放时，Azure 将朗读这里的文字。留空则插入自闭合 audio 元素。" /></label><p>音频必须来自可访问 Internet、具有受信任 TLS/SSL 证书的 HTTPS 地址。文本与所有音频的总时长不能超过 600 秒，音频中不得包含敏感信息。</p></aside>
        </div>
        <footer className="background-audio-dialog-footer"><span>{soundEffectDraftId ? `已选择：${soundEffects.find((effect) => effect.id === soundEffectDraftId)?.title ?? ''}` : '请选择一个音效'}</span><div><button className="secondary-button" onClick={() => setSoundEffectDialogOpen(false)}>取消</button><button className="primary-button" onClick={confirmSoundEffect} disabled={!soundEffectDraftId}><AudioLines size={16} />确认插入</button></div></footer>
      </section>
    </div>}
    {backgroundDialogOpen && <div className="background-audio-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBackgroundDialogOpen(false); }}>
      <section className="background-audio-dialog" role="dialog" aria-modal="true" aria-labelledby="background-audio-dialog-title">
        <header className="background-audio-dialog-header"><div><span><Music2 size={20} /></span><div><h2 id="background-audio-dialog-title">选择背景音乐</h2><p>每份 SSML 只能选择一首背景音乐，并在所有配音片段之前播放。</p></div></div><button className="icon-button" onClick={() => setBackgroundDialogOpen(false)} aria-label="关闭背景音乐选择"><X size={17} /></button></header>
        <div className="background-audio-filters">
          <div className="background-audio-search"><Search size={16} /><input value={backgroundKeyword} onChange={(event) => setBackgroundKeyword(event.target.value)} placeholder="搜索标题、分类、标签或链接" autoFocus /></div>
          <select value={backgroundCategory} onChange={(event) => setBackgroundCategory(event.target.value)} aria-label="按背景音乐分类筛选"><option value="">全部分类</option>{backgroundCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={backgroundTag} onChange={(event) => setBackgroundTag(event.target.value)} aria-label="按背景音乐标签筛选"><option value="">全部标签</option>{backgroundTags.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
        <div className="background-audio-dialog-body">
          <div className="background-audio-results">{backgroundMusicLoading ? <p className="state-message">正在读取背景音乐…</p> : backgroundResults.length ? backgroundResults.map((music) => {
            const selected = backgroundDraft.musicId === music.id;
            return <article className={`background-audio-option ${selected ? 'selected' : ''}`} key={music.id}>
              <button className="background-audio-option-main" onClick={() => setBackgroundDraft((current) => ({ ...current, musicId: music.id }))}><span className="background-audio-option-icon"><Music2 size={17} /></span><span><b title={music.title}>{music.title}</b><small>{music.category}</small><em>{music.tags.length ? music.tags.join(' · ') : '无标签'}</em></span>{selected && <CheckCircle2 size={17} />}</button>
              <button className="icon-button" onClick={() => setTrack(music.url, music.title)} title={`试听${music.title}`}><Play size={14} fill="currentColor" /></button>
            </article>;
          }) : <div className="background-audio-empty"><Music2 size={28} /><b>{backgroundMusic.length ? '没有符合筛选条件的背景音乐' : '背景音乐库为空'}</b><span>{backgroundMusic.length ? '请调整搜索、分类或标签条件。' : '请先前往“背景音乐”页面添加音乐。'}</span></div>}</div>
          <aside className="background-audio-options"><div><b>背景音参数</b><small>根据 Azure SSML 的 mstts:backgroundaudio 属性设置。</small></div><label><span>音量 <em>0–100</em></span><input type="number" min="0" max="100" step="0.1" value={backgroundDraft.volume} onChange={(event) => setBackgroundDraft((current) => ({ ...current, volume: event.target.value }))} disabled={!backgroundDraft.musicId} /></label><label><span>淡入时间 <em>0–10000 ms</em></span><input type="number" min="0" max="10000" step="100" value={backgroundDraft.fadeIn} onChange={(event) => setBackgroundDraft((current) => ({ ...current, fadeIn: event.target.value }))} disabled={!backgroundDraft.musicId} /></label><label><span>淡出时间 <em>0–10000 ms</em></span><input type="number" min="0" max="10000" step="100" value={backgroundDraft.fadeOut} onChange={(event) => setBackgroundDraft((current) => ({ ...current, fadeOut: event.target.value }))} disabled={!backgroundDraft.musicId} /></label><p>音乐较短时会自动循环，并在配音开始和结束时按设置淡入、淡出。</p></aside>
        </div>
        <footer className="background-audio-dialog-footer"><span>{backgroundDraft.musicId ? `已选择：${backgroundMusic.find((music) => music.id === backgroundDraft.musicId)?.title ?? ''}` : '请选择一首背景音乐'}</span><div><button className="secondary-button" onClick={() => setBackgroundDialogOpen(false)}>取消</button><button className="primary-button" onClick={confirmBackgroundAudio} disabled={!backgroundDraft.musicId}><CheckCircle2 size={16} />确认选择</button></div></footer>
      </section>
    </div>}
    {roleDialogOpen && <div className="role-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !createRole.isPending) setRoleDialogOpen(false); }}>
      <section className="role-dialog" role="dialog" aria-modal="true" aria-labelledby="role-dialog-title">
        <header className="role-dialog-header"><div><span className="role-dialog-icon"><Users size={20} /></span><span><h2 id="role-dialog-title">添加角色</h2><p>设置角色名称，并从音色库中选择一个声音。</p></span></div><button className="icon-button" onClick={() => setRoleDialogOpen(false)} disabled={createRole.isPending} aria-label="关闭弹窗"><X size={17} /></button></header>
        <div className="role-dialog-fields">
          <label><span>角色名 <b aria-hidden="true">*</b></span><input value={roleName} maxLength={80} autoFocus onChange={(event) => { setRoleName(event.target.value); if (roleDialogError) setRoleDialogError(''); }} placeholder="例如：旁白、主持人、角色 A" /></label>
          <label><span>搜索音色</span><div className="role-dialog-search"><Search size={16} /><input value={roleKeyword} onChange={(event) => setRoleKeyword(event.target.value)} placeholder="搜索名称、语言或音色 ID" /></div></label>
        </div>
        <div className="voice-library-tabs role-dialog-tabs"><button className={roleTab === 'all' ? 'active' : ''} onClick={() => setRoleTab('all')}>全部音色 <span>{voices.length}</span></button><button className={roleTab === 'favorites' ? 'active' : ''} onClick={() => setRoleTab('favorites')}>收藏 <span>{favoriteVoices.length}</span></button></div>
        <div className="role-voice-scroll"><div className="voice-grid role-voice-grid">{roleTab === 'favorites' && favoritesLoading ? <p className="state-message">正在读取收藏…</p> : roleTab === 'all' && !voices.length ? <p className="state-message">暂无可选音色，请先在设置中连接 Azure Speech。</p> : roleVoiceResults.length ? roleVoiceResults.map((voice) => {
          const selected = selectedRoleVoice?.ShortName === voice.ShortName;
          return <button className={`voice-card role-voice-card ${selected ? 'selected' : ''}`} key={voice.ShortName} onClick={() => { setSelectedRoleVoice(voice); setRoleDialogError(''); }}>
            {favoriteVoiceSet.has(voice.ShortName) && <Heart className="role-voice-favorite" size={14} fill="currentColor" />}
            <div className="voice-avatar large">{voice.LocalName?.slice(0, 1) ?? '声'}</div>
            <div><h3>{voiceName(voice, voice.ShortName)}</h3><p>{voice.LocaleName || voice.Locale} · {voice.Gender === 'Female' ? '女声' : voice.Gender === 'Male' ? '男声' : '音色'}</p></div>
            <div className="voice-tags">{voice.StyleList?.slice(0, 2).map((style) => <span key={style}>{style}</span>)}{selected && <span className="role-selected-tag">已选择</span>}</div>
          </button>;
        }) : <p className="state-message">{roleTab === 'favorites' ? '收藏中没有匹配的音色。' : '没有找到匹配的音色。'}</p>}</div></div>
        <footer className="role-dialog-footer"><span className={`role-dialog-message ${roleDialogError ? 'error' : ''}`}>{roleDialogError || (selectedRoleVoice ? `已选择：${voiceName(selectedRoleVoice, selectedRoleVoice.ShortName)}` : '请选择音色')}</span><div><button className="secondary-button" onClick={() => setRoleDialogOpen(false)} disabled={createRole.isPending}>取消</button><button className="primary-button" onClick={confirmRole} disabled={createRole.isPending}>{createRole.isPending ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}确认添加</button></div></footer>
      </section>
    </div>}
    {editingRole && <div className="role-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !updateRole.isPending) setEditingRole(null); }}>
      <section className="role-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="role-edit-title">
        <header className="role-dialog-header"><div><span className="role-dialog-icon"><Pencil size={19} /></span><span><h2 id="role-edit-title">编辑角色</h2><p>修改角色名称和默认语速。</p></span></div><button className="icon-button" onClick={() => setEditingRole(null)} disabled={updateRole.isPending} aria-label="关闭弹窗"><X size={17} /></button></header>
        <div className="role-edit-fields"><label><span>角色名 <b aria-hidden="true">*</b></span><input value={editRoleName} maxLength={80} autoFocus onChange={(event) => { setEditRoleName(event.target.value); if (editRoleError) setEditRoleError(''); }} placeholder="请输入角色名" /></label><label><span>默认语速</span><select value={editRoleRate} onChange={(event) => setEditRoleRate(event.target.value)}><option value="x-slow">x-slow · 0.5x · -50%</option><option value="slow">slow · 0.64x · -46%</option><option value="medium">medium · 1.0x · 默认</option><option value="fast">fast · 1.55x · +55%</option><option value="x-fast">x-fast · 2.0x · +100%</option></select></label></div>
        <footer className="role-dialog-footer"><span className={`role-dialog-message ${editRoleError ? 'error' : ''}`}>{editRoleError || `当前音色：${voiceName(editingRole.voice, editingRole.voice.ShortName)}`}</span><div><button className="secondary-button" onClick={() => setEditingRole(null)} disabled={updateRole.isPending}>取消</button><button className="primary-button" onClick={confirmEditRole} disabled={updateRole.isPending}>{updateRole.isPending ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}保存修改</button></div></footer>
      </section>
    </div>}
  </>;
}
