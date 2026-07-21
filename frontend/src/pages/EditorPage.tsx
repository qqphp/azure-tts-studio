import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { xml } from '@codemirror/lang-xml';
import CodeMirror from '@uiw/react-codemirror';
import {
  AudioLines,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  FileCode2,
  Gauge,
  Heart,
  LoaderCircle,
  Languages,
  Pencil,
  Play,
  Plus,
  Pause,
  RotateCcw,
  Search,
  Trash2,
  Users,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';
import { usePlayerStore } from '../stores/player-store';
import type { EditorRole, Voice } from '../types/api';

type EditorSegment = {
  id: string;
  roleId?: number;
  name: string;
  voice: string;
  style: string;
  role: string;
  rate: string;
  text: string;
};

type SsmlTool = {
  label: string;
  hint: string;
  open?: string;
  close?: string;
  insert?: string;
};

const ssmlToolGroups: { label: string; tools: SsmlTool[] }[] = [
  { label: '情感', tools: [] },
  { label: '副语言', tools: [] },
  { label: '角色', tools: [] },
  { label: '语速', tools: [] },
  { label: '停顿', tools: [] },
  { label: '静音', tools: [] },
  { label: '音效', tools: [] },
];

const ssmlToolIcons = [Heart, Languages, Users, Gauge, Pause, VolumeX, AudioLines];

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

// Escape regular text while keeping the SSML elements inserted by the visual tools intact.
const escapeSsmlContent = (value: string) => value
  .split(/(<[^>]+>)/g)
  .map((part) => part.startsWith('<') && part.endsWith('>') ? part : escapeXml(part))
  .join('');

const buildSsml = (segments: EditorSegment[]) => {
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
      return `  <voice name="${escapeXml(segment.voice)}">\n    ${expression}\n  </voice>`;
    })
    .join('\n');

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">\n${content}\n</speak>`;
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

  const compiledSsml = useMemo(() => buildSsml(segments), [segments]);
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

  const resetEditor = () => {
    if (!window.confirm('确定恢复为初始编排吗？当前内容将被替换。')) return;
    setSegments(starterSegments);
    setActiveSegmentId(starterSegments[0].id);
    setSource(buildSsml(starterSegments));
    setView('visual');
    setMessage('已恢复初始编排。');
  };

  const previewSegment = (segment: EditorSegment) => synthesize.mutate(buildSsml([segment]));
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
