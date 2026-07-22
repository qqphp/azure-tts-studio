import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AudioLines, ChevronLeft, ChevronRight, Heart, LoaderCircle, Play, RotateCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';
import { usePlayerStore } from '../stores/player-store';
import type { Voice } from '../types/api';
import {
  filterVoices,
  initialVoiceFilters,
  localeNames,
  localizedLabel,
  personalityLabels,
  roleLabels,
  scenarioLabels,
  statusLabels,
  typeLabels,
  voiceFilterOptions,
  type VoiceFilterState,
} from '../voice-filters';

const PAGE_SIZE = 10;

type BatchProgress = {
  running: boolean;
  completed: number;
  total: number;
  failed: number;
};

const voiceTitle = (voice: Voice) => voice.LocalName || voice.DisplayName || voice.ShortName;

export function VoicesPage() {
  const client = useQueryClient();
  const setTrack = usePlayerStore((state) => state.setTrack);
  const [filters, setFilters] = useState<VoiceFilterState>(initialVoiceFilters);
  const [tab, setTab] = useState<'all' | 'favorites'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [previewMessage, setPreviewMessage] = useState('');
  const { data: voices = [], isLoading, error } = useQuery({ queryKey: ['voices'], queryFn: api.voices });
  const { data: favorites = [], isLoading: favoritesLoading } = useQuery({ queryKey: ['voice-favorite-items'], queryFn: api.favoriteVoiceItems });
  const { data: previews = [] } = useQuery({ queryKey: ['voice-previews'], queryFn: api.voicePreviews });
  const favoriteSet = useMemo(() => new Set(favorites.map((voice) => voice.ShortName)), [favorites]);
  const previewMap = useMemo(() => new Map(previews.map((preview) => [preview.shortName, preview])), [previews]);
  const cachedVoiceCount = useMemo(() => voices.filter((voice) => previewMap.has(voice.ShortName)).length, [previewMap, voices]);
  const source = tab === 'favorites' ? favorites : voices;
  const options = useMemo(() => voiceFilterOptions(voices), [voices]);
  const results = useMemo(() => filterVoices(source, filters), [source, filters]);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visibleResults = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const updateFilter = <K extends keyof VoiceFilterState>(key: K, value: VoiceFilterState[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const favorite = useMutation({
    mutationFn: async (voice: Voice) => favoriteSet.has(voice.ShortName) ? api.removeFavoriteVoice(voice.ShortName) : api.addFavoriteVoice(voice),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['voice-favorites'] });
      client.invalidateQueries({ queryKey: ['voice-favorite-items'] });
    },
  });
  const preview = useMutation({
    mutationFn: async (voice: Voice) => ({ voice, result: await api.ensureVoicePreview(voice) }),
    onSuccess: ({ voice, result }) => {
      client.invalidateQueries({ queryKey: ['voice-previews'] });
      setTrack(result.url, `${voiceTitle(voice)} · 离线试听`);
      setPreviewMessage(`已生成并缓存“${voiceTitle(voice)}”的试听音频。`);
    },
    onError: (cause) => setPreviewMessage(cause instanceof Error ? cause.message : '试听音频生成失败'),
  });

  useEffect(() => { setCurrentPage(1); }, [tab, filters]);
  useEffect(() => { setCurrentPage((page) => Math.min(page, pageCount)); }, [pageCount]);

  const playPreview = (voice: Voice) => {
    const cached = previewMap.get(voice.ShortName);
    if (cached) {
      setTrack(cached.url, `${voiceTitle(voice)} · 离线试听`);
      setPreviewMessage(`正在播放 ${cached.locale} 示例：${cached.text}`);
      return;
    }
    preview.mutate(voice);
  };

  const generateAllPreviews = async () => {
    if (!voices.length || batchProgress?.running) return;
    const pending = voices.filter((voice) => !previewMap.has(voice.ShortName));
    if (!pending.length) {
      setPreviewMessage('全部音色都已有离线试听，无需重新生成。');
      return;
    }
    setBatchProgress({ running: true, completed: 0, total: pending.length, failed: 0 });
    setPreviewMessage(`开始补齐 ${pending.length} 个离线试听，请保持页面打开。`);
    let completed = 0;
    let failed = 0;
    for (const voice of pending) {
      try {
        await api.ensureVoicePreview(voice);
      } catch {
        failed += 1;
      }
      completed += 1;
      setBatchProgress({ running: true, completed, total: pending.length, failed });
    }
    setBatchProgress({ running: false, completed, total: pending.length, failed });
    await client.invalidateQueries({ queryKey: ['voice-previews'] });
    setPreviewMessage(failed ? `离线试听补齐完成：成功 ${completed - failed} 个，失败 ${failed} 个。` : `离线试听补齐完成：成功生成 ${completed} 个。`);
  };

  return <>
    <PageHeader eyebrow="VOICE LIBRARY" title="探索适合你的声音" description="音色中心独立管理收藏和离线试听，不影响工作台的音色列表。" />
    <div className="voice-preview-toolbar">
      <div className="voice-library-tabs">
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>全部音色</button>
        <button className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>收藏 <span>{favorites.length}</span></button>
      </div>
      <div className="voice-preview-cache-actions">
        <span>已缓存 {cachedVoiceCount} / {voices.length || '—'}</span>
        <button className="secondary-button" onClick={generateAllPreviews} disabled={!voices.length || batchProgress?.running}>
          {batchProgress?.running ? <LoaderCircle className="spin" size={15} /> : <AudioLines size={15} />}
          {batchProgress?.running ? `生成中 ${batchProgress.completed}/${batchProgress.total}` : '补齐离线试听'}
        </button>
      </div>
    </div>
    <div className="voice-filter-panel voice-library-filter-panel">
      <div className="voice-search"><Search size={16} /><input value={filters.keyword} onChange={(event) => updateFilter('keyword', event.target.value)} placeholder="搜索音色 / 名称 / 地区…" /></div>
      <div className="voice-filter-grid">
        <select value={filters.locale} onChange={(event) => updateFilter('locale', event.target.value)}><option value="">全部语言</option>{options.locales.map((item) => <option key={item} value={item}>{localeNames[item] || item}</option>)}</select>
        <select value={filters.gender} onChange={(event) => updateFilter('gender', event.target.value)}><option value="">全部性别</option><option value="Female">女声</option><option value="Male">男声</option></select>
        <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}><option value="">全部类型</option>{options.types.map((item) => <option key={item} value={item}>{item} · {typeLabels[item] || item}</option>)}</select>
        <select value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}><option value="">全部年龄感 / 角色</option>{options.roles.map((item) => <option key={item} value={item}>{roleLabels[item] || item}</option>)}</select>
        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">全部状态</option>{options.statuses.map((item) => <option key={item} value={item}>{item} · {statusLabels[item] || item}</option>)}</select>
        <select value={filters.scenario} onChange={(event) => updateFilter('scenario', event.target.value)}><option value="">全部使用场景</option>{options.scenarios.map((item) => <option key={item} value={item}>{item} · {localizedLabel(item, scenarioLabels)}</option>)}</select>
        <select value={filters.personality} onChange={(event) => updateFilter('personality', event.target.value)}><option value="">全部音色人格</option>{options.personalities.map((item) => <option key={item} value={item}>{item} · {localizedLabel(item, personalityLabels)}</option>)}</select>
        <select value={filters.model} onChange={(event) => updateFilter('model', event.target.value)}><option value="">全部模型系列</option>{options.models.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={filters.source} onChange={(event) => updateFilter('source', event.target.value)}><option value="">全部模型来源</option>{options.sources.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      </div>
      <div className="voice-filter-actions">
        <label><input type="checkbox" checked={filters.styleOnly} onChange={(event) => updateFilter('styleOnly', event.target.checked)} />仅支持风格</label>
        <button className="text-button" onClick={() => setFilters(initialVoiceFilters)}><RotateCcw size={14} />重置筛选</button>
      </div>
    </div>
    {previewMessage && <p className={`voice-preview-message ${preview.isError || batchProgress?.failed ? 'error' : ''}`}>{previewMessage}</p>}
    {tab === 'all' && isLoading ? <p className="state-message">正在加载音色…</p> : tab === 'all' && error ? <p className="state-message error">{error.message}。请先在设置中连接 Azure Speech。</p> : tab === 'favorites' && favoritesLoading ? <p className="state-message">正在读取收藏…</p> : <div className="voice-library-content">
      <div className="voice-grid">{results.length ? visibleResults.map((voice) => {
        const cached = previewMap.has(voice.ShortName);
        const generating = preview.isPending && preview.variables?.ShortName === voice.ShortName;
        return <article className="voice-card" key={voice.ShortName}>
          <button className={`favorite-button ${favoriteSet.has(voice.ShortName) ? 'active' : ''}`} onClick={() => favorite.mutate(voice)} aria-label={favoriteSet.has(voice.ShortName) ? '取消收藏' : '收藏'}><Heart size={16} fill={favoriteSet.has(voice.ShortName) ? 'currentColor' : 'none'} /></button>
          <div className="voice-avatar large">{voice.LocalName?.slice(0, 1) ?? '声'}</div>
          <div><h3>{voiceTitle(voice)}</h3><p>{voice.LocaleName || voice.Locale} · {voice.Gender === 'Female' ? '女声' : '男声'}</p></div>
          <div className="voice-tags">{voice.StyleList?.slice(0, 3).map((style) => <span key={style}>{style}</span>)}</div>
          <button className="secondary-button voice-preview-button" onClick={() => playPreview(voice)} disabled={generating || Boolean(batchProgress?.running && !cached)}>{generating ? <LoaderCircle className="spin" size={14} /> : <Play size={14} fill="currentColor" />}<span>{cached ? '离线试听' : '生成并试听'}</span></button>
        </article>;
      }) : <p className="state-message">{tab === 'favorites' ? '收藏为空，点击全部音色中的心形按钮收藏音色。' : '没有找到匹配的音色。'}</p>}</div>
      {results.length > 0 && <div className="voice-pagination"><span>第 {currentPage} / {pageCount} 页</span><div><button className="pagination-button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} aria-label="上一页"><ChevronLeft size={16} /></button><button className="pagination-button" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => page + 1)} aria-label="下一页"><ChevronRight size={16} /></button></div></div>}
    </div>}
  </>;
}
