import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Clock3, Download, Play, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';
import { usePlayerStore } from '../stores/player-store';

const PAGE_SIZE = 8;

export function HistoryPage() {
  const client = useQueryClient();
  const setTrack = usePlayerStore((state) => state.setTrack);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const { data: records = [], isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['history'], queryFn: api.history });
  const deletion = useMutation({ mutationFn: api.deleteHistory, onSuccess: () => client.invalidateQueries({ queryKey: ['history'] }) });
  const batchDeletion = useMutation({ mutationFn: api.deleteHistoryBatch, onSuccess: () => { setSelectedIds([]); client.invalidateQueries({ queryKey: ['history'] }); } });
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const visibleRecords = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const currentPageSelected = visibleRecords.filter((record) => selectedIds.includes(record.id)).length;
  const allSelected = visibleRecords.length > 0 && currentPageSelected === visibleRecords.length;
  const someSelected = currentPageSelected > 0 && !allSelected;

  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected; }, [someSelected]);
  useEffect(() => { setCurrentPage((page) => Math.min(page, pageCount)); }, [pageCount]);
  useEffect(() => {
    setSelectedIds((ids) => {
      const next = ids.filter((id) => records.some((record) => record.id === id));
      return next.length === ids.length ? ids : next;
    });
  }, [records]);

  const toggleSelected = (id: string) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const toggleSelectAll = () => setSelectedIds((ids) => allSelected ? ids.filter((id) => !visibleRecords.some((record) => record.id === id)) : [...new Set([...ids, ...visibleRecords.map((record) => record.id)])]);
  const remove = (id: string) => { if (window.confirm('确定删除这条历史记录吗？')) deletion.mutate(id); };
  const removeSelected = () => { if (selectedIds.length && window.confirm(`确定删除选中的 ${selectedIds.length} 条历史记录吗？此操作不可撤销。`)) batchDeletion.mutate(selectedIds); };

  return <>
    <PageHeader eyebrow="PROJECT HISTORY" title="你的配音记录" description="管理已生成的音频，随时下载或复用参数。" />
    {isLoading ? <p className="state-message">正在读取历史记录…</p> : error ? <p className="state-message error">{error.message}</p> : <section className="card table-card history-card">
      <div className="history-list-toolbar">
        <div className="history-selection">
          <label className="select-all-control"><input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={!records.length || batchDeletion.isPending} /><span>{someSelected ? `已选 ${selectedIds.length} 条` : '全选'}</span></label>
          {records.length > 0 && <span className="history-total">共 {records.length} 条记录</span>}
        </div>
        <div className="history-toolbar">
          <button className="secondary-button" disabled={!selectedIds.length || batchDeletion.isPending} onClick={removeSelected}><Trash2 size={15} />批量删除</button>
          <button className="secondary-button" disabled={isFetching} onClick={() => refetch()}><RefreshCw className={isFetching ? 'spin' : undefined} size={15} />刷新</button>
        </div>
      </div>
      <div className="history-table-head"><span aria-hidden="true"></span><span>内容</span><span>音色</span><span>创建时间</span><span>操作</span></div>
      <div className="history-rows">{records.length ? visibleRecords.map((record) => <div className="history-row" key={record.id}>
        <label className="row-checkbox"><input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggleSelected(record.id)} aria-label={`选择${record.text || '未命名配音'}`} /></label>
        <div><b>{record.text || '未命名配音'}</b><small>{record.mode === 'professional' ? '专业配音' : '快速配音'}</small></div>
        <span>{record.voice || '未知音色'}</span>
        <span><Clock3 size={14} /> {new Date(record.ts * 1000).toLocaleString('zh-CN', { hour12: false })}</span>
        <span><button className="icon-button" onClick={() => setTrack(`/api/history/${record.id}`, record.voice || '历史配音')} title="播放"><Play size={16} /></button><a className="icon-button" title="下载" href={`/api/history/${record.id}`} download><Download size={16} /></a><button className="icon-button danger" disabled={deletion.isPending || batchDeletion.isPending} onClick={() => remove(record.id)} title="删除"><Trash2 size={16} /></button></span>
      </div>) : <p className="state-message">还没有生成记录。</p>}</div>
      {records.length > 0 && <div className="history-pagination"><span>第 {currentPage} / {pageCount} 页</span><div><button className="pagination-button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} aria-label="上一页"><ChevronLeft size={16} /></button><button className="pagination-button" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => page + 1)} aria-label="下一页"><ChevronRight size={16} /></button></div></div>}
    </section>}
  </>;
}
