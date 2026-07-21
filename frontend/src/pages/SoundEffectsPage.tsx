import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readSheet, type Row as ExcelRow } from 'read-excel-file/browser';
import writeXlsxFile, { type Cell } from 'write-excel-file/browser';
import { AudioLines, ChevronLeft, ChevronRight, Download, ExternalLink, FileDown, Pencil, Play, Plus, Search, Tags, Trash2, Upload, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';
import { usePlayerStore } from '../stores/player-store';
import type { SoundEffect } from '../types/api';

type SoundEffectForm = { title: string; tags: string; category: string; url: string };
const emptyForm: SoundEffectForm = { title: '', tags: '', category: '', url: '' };
const PAGE_SIZE = 10;
const IMPORT_HEADERS = ['标题', '标签', '分类', '链接'];

const splitTags = (value: string) => [...new Set(value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))];
const excelHeader = (value: string): Cell => ({ value, type: String, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#3F8068', align: 'center' });
const excelColumns = [{ width: 24 }, { width: 28 }, { width: 18 }, { width: 60 }, { width: 22 }];

const downloadWorkbook = async (effects: SoundEffect[], fileName: string, includeCreatedAt: boolean) => {
  const rows: Cell[][] = [
    [...IMPORT_HEADERS, ...(includeCreatedAt ? ['创建时间'] : [])].map(excelHeader),
    ...effects.map((effect) => [
      { value: effect.title, type: String },
      { value: effect.tags.join(', '), type: String, wrap: true },
      { value: effect.category, type: String },
      { value: effect.url, type: String },
      ...(includeCreatedAt ? [{ value: new Date(effect.createdAt * 1000), type: Date, format: 'yyyy-mm-dd hh:mm:ss' } as Cell] : []),
    ]),
  ];
  await writeXlsxFile(rows, { columns: excelColumns.slice(0, includeCreatedAt ? 5 : 4), sheet: '音效数据', stickyRowsCount: 1 }).toFile(fileName);
};

export function SoundEffectsPage() {
  const client = useQueryClient();
  const setTrack = usePlayerStore((state) => state.setTrack);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEffect, setEditingEffect] = useState<SoundEffect | null>(null);
  const [form, setForm] = useState<SoundEffectForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [importStatus, setImportStatus] = useState('');

  const { data: effects = [], isLoading, error } = useQuery({ queryKey: ['sound-effects'], queryFn: api.soundEffects });
  const categories = useMemo(() => [...new Set(effects.map((effect) => effect.category))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [effects]);
  const tags = useMemo(() => [...new Set(effects.flatMap((effect) => effect.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [effects]);
  const filteredEffects = useMemo(() => {
    const cleanKeyword = keyword.trim().toLowerCase();
    return effects.filter((effect) => {
      const matchesKeyword = !cleanKeyword || `${effect.title} ${effect.category} ${effect.tags.join(' ')} ${effect.url}`.toLowerCase().includes(cleanKeyword);
      return matchesKeyword && (!category || effect.category === category) && (!tag || effect.tags.includes(tag));
    });
  }, [category, effects, keyword, tag]);
  const pageCount = Math.max(1, Math.ceil(filteredEffects.length / PAGE_SIZE));
  const visibleEffects = filteredEffects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectedVisibleCount = visibleEffects.filter((effect) => selectedIds.includes(effect.id)).length;
  const allSelected = visibleEffects.length > 0 && selectedVisibleCount === visibleEffects.length;
  const someSelected = selectedVisibleCount > 0 && !allSelected;

  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected; }, [someSelected]);
  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => effects.some((effect) => effect.id === id)));
  }, [effects]);
  useEffect(() => { setCurrentPage(1); }, [category, keyword, tag]);
  useEffect(() => { setCurrentPage((page) => Math.min(page, pageCount)); }, [pageCount]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingEffect(null);
    setForm(emptyForm);
    setFormError('');
  };
  const openCreateDialog = () => {
    setEditingEffect(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  };
  const openEditDialog = (effect: SoundEffect) => {
    setEditingEffect(effect);
    setForm({ title: effect.title, tags: effect.tags.join(', '), category: effect.category, url: effect.url });
    setFormError('');
    setDialogOpen(true);
  };
  const refresh = () => client.invalidateQueries({ queryKey: ['sound-effects'] });
  const createEffect = useMutation({ mutationFn: api.createSoundEffect, onSuccess: () => { closeDialog(); refresh(); }, onError: (cause) => setFormError(cause instanceof Error ? cause.message : '添加音效失败') });
  const updateEffect = useMutation({ mutationFn: ({ id, data }: { id: number; data: Omit<SoundEffect, 'id' | 'createdAt'> }) => api.updateSoundEffect(id, data), onSuccess: () => { closeDialog(); refresh(); }, onError: (cause) => setFormError(cause instanceof Error ? cause.message : '编辑音效失败') });
  const deleteEffect = useMutation({ mutationFn: api.deleteSoundEffect, onSuccess: refresh });
  const batchDelete = useMutation({ mutationFn: api.deleteSoundEffectsBatch, onSuccess: () => { setSelectedIds([]); refresh(); } });
  const importEffects = useMutation({
    mutationFn: async (file: File) => {
      const rows = await readSheet(file);
      if (!rows.length) throw new Error('Excel 文件中没有数据');
      const headers = rows[0].map((cell) => String(cell ?? '').trim());
      const indexes = IMPORT_HEADERS.map((header) => headers.indexOf(header));
      if (indexes.some((index) => index < 0)) throw new Error(`Excel 必须包含列：${IMPORT_HEADERS.join('、')}`);
      const records = rows.slice(1).map((row: ExcelRow, index: number) => ({
        rowNumber: index + 2,
        title: String(row[indexes[0]] ?? '').trim(),
        tags: splitTags(String(row[indexes[1]] ?? '')),
        category: String(row[indexes[2]] ?? '').trim(),
        url: String(row[indexes[3]] ?? '').trim(),
      })).filter((record) => record.title || record.category || record.url || record.tags.length);
      if (!records.length) throw new Error('Excel 文件中没有可导入的音效数据');
      let created = 0;
      const failures: string[] = [];
      for (const record of records) {
        try {
          await api.createSoundEffect({ title: record.title, tags: record.tags, category: record.category, url: record.url });
          created += 1;
        } catch (cause) {
          failures.push(`第 ${record.rowNumber} 行：${cause instanceof Error ? cause.message : '导入失败'}`);
        }
      }
      return { created, failures };
    },
    onSuccess: ({ created, failures }) => {
      refresh();
      setImportStatus(failures.length ? `成功导入 ${created} 条，${failures.length} 条失败：${failures.slice(0, 2).join('；')}` : `成功导入 ${created} 条音效。`);
    },
    onError: (cause) => setImportStatus(cause instanceof Error ? cause.message : '导入失败'),
  });

  const submit = () => {
    const data = { title: form.title.trim(), tags: splitTags(form.tags), category: form.category.trim(), url: form.url.trim() };
    if (!data.title || !data.category || !data.url) {
      setFormError('请填写标题、分类和链接');
      return;
    }
    setFormError('');
    if (editingEffect) updateEffect.mutate({ id: editingEffect.id, data });
    else createEffect.mutate(data);
  };
  const removeOne = (effect: SoundEffect) => {
    if (window.confirm(`确定删除音效“${effect.title}”吗？`)) deleteEffect.mutate(effect.id);
  };
  const removeSelected = () => {
    if (selectedIds.length && window.confirm(`确定删除选中的 ${selectedIds.length} 个音效吗？此操作不可撤销。`)) batchDelete.mutate(selectedIds);
  };
  const toggleOne = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAll = () => setSelectedIds((current) => allSelected
    ? current.filter((id) => !visibleEffects.some((effect) => effect.id === id))
    : [...new Set([...current, ...visibleEffects.map((effect) => effect.id)])]);
  const importExcel = (file?: File) => {
    if (!file) return;
    setImportStatus('');
    importEffects.mutate(file);
  };
  const pending = createEffect.isPending || updateEffect.isPending;

  return <>
    <PageHeader eyebrow="SOUND EFFECT LIBRARY" title="音效中心" description="集中管理配音中使用的环境声、转场、提示音和其他音频素材。" />
    <section className="sound-effects-filter card">
      <div className="sound-effects-search"><Search size={17} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题、分类、标签或链接" /></div>
      <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="按分类查看"><option value="">全部分类</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={tag} onChange={(event) => setTag(event.target.value)} aria-label="按标签查看"><option value="">全部标签</option>{tags.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <button className="primary-button" onClick={openCreateDialog}><Plus size={16} />添加音效</button>
    </section>

    {isLoading ? <p className="state-message">正在读取音效…</p> : error ? <p className="state-message error">{error.message}</p> : <section className="sound-effects-table-card card">
      <div className="sound-effects-table-toolbar">
        <label className="select-all-control"><input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!filteredEffects.length || batchDelete.isPending} /><span>{someSelected || selectedIds.length ? `已选 ${selectedIds.length} 项` : '全选'}</span></label>
        <span>共 {effects.length} 个音效，当前筛选 {filteredEffects.length} 个{importStatus && <small className={importEffects.isError ? 'error' : ''}>{importStatus}</small>}</span>
        <div className="sound-effects-toolbar-actions">
          <button className="secondary-button" onClick={() => downloadWorkbook([], '音效导入模板.xlsx', false)}><FileDown size={14} />导出模板</button>
          <button className="secondary-button" disabled={!effects.length} onClick={() => downloadWorkbook(effects, '音效数据.xlsx', true)}><Download size={14} />导出数据</button>
          <button className="secondary-button" disabled={importEffects.isPending} onClick={() => importInputRef.current?.click()}><Upload size={14} />{importEffects.isPending ? '导入中…' : '导入数据'}</button>
          <input ref={importInputRef} className="sound-effects-file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { importExcel(event.target.files?.[0]); event.target.value = ''; }} />
          <button className="secondary-button" disabled={!selectedIds.length || batchDelete.isPending} onClick={removeSelected}><Trash2 size={14} />批量删除</button>
        </div>
      </div>
      <div className="sound-effects-table-scroll">
        <table className="sound-effects-table">
          <thead><tr><th aria-label="选择"></th><th>标题</th><th>标签</th><th>分类</th><th>链接</th><th>创建时间</th><th>操作</th></tr></thead>
          <tbody>{filteredEffects.length ? visibleEffects.map((effect) => <tr key={effect.id}>
            <td><input type="checkbox" checked={selectedIds.includes(effect.id)} onChange={() => toggleOne(effect.id)} aria-label={`选择${effect.title}`} /></td>
            <td><span className="sound-effect-title"><AudioLines size={16} /><b title={effect.title}>{effect.title}</b></span></td>
            <td><div className="sound-effect-tags">{effect.tags.length ? effect.tags.map((item) => <span key={item}>{item}</span>) : <em>无标签</em>}</div></td>
            <td><span className="sound-effect-category">{effect.category}</span></td>
            <td><a className="sound-effect-link" href={effect.url} target="_blank" rel="noreferrer" title={effect.url}><span>{effect.url}</span><ExternalLink size={13} /></a></td>
            <td>{new Date(effect.createdAt * 1000).toLocaleString('zh-CN', { hour12: false })}</td>
            <td><div className="sound-effect-actions"><button className="icon-button" onClick={() => setTrack(effect.url, effect.title)} title="播放"><Play size={15} fill="currentColor" /></button><button className="icon-button" onClick={() => openEditDialog(effect)} title="编辑"><Pencil size={15} /></button><button className="icon-button danger" disabled={deleteEffect.isPending || batchDelete.isPending} onClick={() => removeOne(effect)} title="删除"><Trash2 size={15} /></button></div></td>
          </tr>) : <tr><td className="sound-effects-empty" colSpan={7}>{effects.length ? '没有符合筛选条件的音效。' : '还没有音效，点击“添加音效”创建第一条记录。'}</td></tr>}</tbody>
        </table>
      </div>
      {filteredEffects.length > 0 && <div className="sound-effects-pagination"><span>第 {currentPage} / {pageCount} 页 · 每页 {PAGE_SIZE} 条</span><div><button className="pagination-button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} aria-label="上一页"><ChevronLeft size={16} /></button><button className="pagination-button" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => page + 1)} aria-label="下一页"><ChevronRight size={16} /></button></div></div>}
    </section>}

    {dialogOpen && <div className="sound-effect-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) closeDialog(); }}>
      <section className="sound-effect-dialog card" role="dialog" aria-modal="true" aria-labelledby="sound-effect-dialog-title">
        <header><div><span><AudioLines size={19} /></span><div><h2 id="sound-effect-dialog-title">{editingEffect ? '编辑音效' : '添加音效'}</h2><p>保存可供专业配音使用的在线音频素材。</p></div></div><button className="icon-button" onClick={closeDialog} disabled={pending} aria-label="关闭"><X size={17} /></button></header>
        <div className="sound-effect-form">
          <label><span>标题 <b>*</b></span><input autoFocus value={form.title} maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：清晨鸟鸣" /></label>
          <label><span>分类 <b>*</b></span><input value={form.category} maxLength={80} list="sound-effect-categories" onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="例如：环境音、转场、提示音" /><datalist id="sound-effect-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist></label>
          <label className="sound-effect-tags-field"><span>标签</span><div><Tags size={15} /><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="使用逗号分隔，例如：自然, 森林, 清晨" /></div></label>
          <label className="sound-effect-url-field"><span>链接 <b>*</b></span><input value={form.url} maxLength={2048} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://example.com/audio.mp3" /><small>音频文件必须是有效的 *.mp3、*.wav、*.opus、*.ogg、*.flac 或 *.wma 文件，音频文件的总时间不能超过 300 秒。</small><small>音频必须托管在可访问 Internet 的 HTTPS 终结点上。需要 HTTPS，托管文件的域必须提供有效的受信任的 TLS/SSL 证书。</small></label>
        </div>
        <footer><span className={formError ? 'error' : ''}>{formError}</span><div><button className="secondary-button" onClick={closeDialog} disabled={pending}>取消</button><button className="primary-button" onClick={submit} disabled={pending}>{editingEffect ? '保存修改' : '确认添加'}</button></div></footer>
      </section>
    </div>}
  </>;
}
