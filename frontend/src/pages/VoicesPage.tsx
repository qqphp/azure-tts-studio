import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Heart, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';

const PAGE_SIZE = 10;

export function VoicesPage() {
  const client = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<'all' | 'favorites'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const { data: voices = [], isLoading, error } = useQuery({ queryKey: ['voices'], queryFn: api.voices });
  const { data: favorites = [], isLoading: favoritesLoading } = useQuery({ queryKey: ['voice-favorite-items'], queryFn: api.favoriteVoiceItems });
  const favoriteSet = useMemo(() => new Set(favorites.map((voice) => voice.ShortName)), [favorites]);
  const source = tab === 'favorites' ? favorites : voices;
  const results = useMemo(() => source.filter((voice) => `${voice.ShortName} ${voice.LocalName} ${voice.DisplayName} ${voice.LocaleName}`.toLowerCase().includes(keyword.toLowerCase())), [source, keyword]);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visibleResults = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const favorite = useMutation({ mutationFn: async (voice: typeof voices[number]) => favoriteSet.has(voice.ShortName) ? api.removeFavoriteVoice(voice.ShortName) : api.addFavoriteVoice(voice), onSuccess: () => { client.invalidateQueries({ queryKey: ['voice-favorites'] }); client.invalidateQueries({ queryKey: ['voice-favorite-items'] }); } });

  useEffect(() => { setCurrentPage(1); }, [tab, keyword]);
  useEffect(() => { setCurrentPage((page) => Math.min(page, pageCount)); }, [pageCount]);

  return <><PageHeader eyebrow="VOICE LIBRARY" title="探索适合你的声音" description="音色中心独立管理收藏数据，不影响工作台的音色列表。" /><div className="voice-library-tabs"><button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>全部音色</button><button className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>收藏 <span>{favorites.length}</span></button></div><div className="filter-input"><Search size={18} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索名称、语言或音色 ID" /></div>{tab === 'all' && isLoading ? <p className="state-message">正在加载音色…</p> : tab === 'all' && error ? <p className="state-message error">{error.message}。请先在设置中连接 Azure Speech。</p> : tab === 'favorites' && favoritesLoading ? <p className="state-message">正在读取收藏…</p> : <div className="voice-library-content"><div className="voice-grid">{results.length ? visibleResults.map((voice) => <article className="voice-card" key={voice.ShortName}><button className={`favorite-button ${favoriteSet.has(voice.ShortName) ? 'active' : ''}`} onClick={() => favorite.mutate(voice)} aria-label={favoriteSet.has(voice.ShortName) ? '取消收藏' : '收藏'}><Heart size={16} fill={favoriteSet.has(voice.ShortName) ? 'currentColor' : 'none'} /></button><div className="voice-avatar large">{voice.LocalName?.slice(0, 1) ?? '声'}</div><div><h3>{voice.LocalName || voice.DisplayName || voice.ShortName}</h3><p>{voice.LocaleName || voice.Locale} · {voice.Gender === 'Female' ? '女声' : '男声'}</p></div><div className="voice-tags">{voice.StyleList?.slice(0, 3).map((style) => <span key={style}>{style}</span>)}</div></article>) : <p className="state-message">{tab === 'favorites' ? '收藏为空，点击全部音色中的心形按钮收藏音色。' : '没有找到匹配的音色。'}</p>}</div>{results.length > 0 && <div className="voice-pagination"><span>第 {currentPage} / {pageCount} 页</span><div><button className="pagination-button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} aria-label="上一页"><ChevronLeft size={16} /></button><button className="pagination-button" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => page + 1)} aria-label="下一页"><ChevronRight size={16} /></button></div></div>}</div>}</>;
}
