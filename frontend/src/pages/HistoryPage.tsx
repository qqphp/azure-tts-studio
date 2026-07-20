import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Download, Play, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';
import { usePlayerStore } from '../stores/player-store';

export function HistoryPage() {
  const client = useQueryClient(); const setTrack = usePlayerStore((state) => state.setTrack); const { data: records = [], isLoading, error } = useQuery({ queryKey: ['history'], queryFn: api.history }); const deletion = useMutation({ mutationFn: api.deleteHistory, onSuccess: () => client.invalidateQueries({ queryKey: ['history'] }) });
  const remove = (id: string) => { if (window.confirm('确定删除这条历史记录吗？')) deletion.mutate(id); };
  return <><PageHeader eyebrow="PROJECT HISTORY" title="你的配音记录" description="管理已生成的音频，随时下载或复用参数。" />{isLoading ? <p className="state-message">正在读取历史记录…</p> : error ? <p className="state-message error">{error.message}</p> : <section className="card table-card"><div className="history-table-head"><span>内容</span><span>音色</span><span>创建时间</span><span>操作</span></div>{records.length ? records.map((record) => <div className="history-row" key={record.id}><div><b>{record.text || '未命名配音'}</b><small>{record.mode === 'professional' ? '专业编辑器' : '快速配音'}</small></div><span>{record.voice || '未知音色'}</span><span><Clock3 size={14} /> {new Date(record.ts * 1000).toLocaleString('zh-CN', { hour12: false })}</span><span><button className="icon-button" onClick={() => setTrack(`/api/history/${record.id}`, record.voice || '历史配音')} title="播放"><Play size={16} /></button><a className="icon-button" title="下载" href={`/api/history/${record.id}`} download><Download size={16} /></a><button className="icon-button danger" disabled={deletion.isPending} onClick={() => remove(record.id)} title="删除"><Trash2 size={16} /></button></span></div>) : <p className="state-message">还没有生成记录。</p>}</section>}</>;
}
