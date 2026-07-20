import { $, api, toast } from './core.js';
import { playBlob } from './media-player.js';

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const selectedIds = () => [...document.querySelectorAll('.h-sel:checked')].map((box) => box.dataset.id);

function updateBatchButton() {
  const button = $('batchDeleteHistory');
  if (!button) return;
  const ids = selectedIds();
  button.disabled = ids.length === 0;
  button.textContent = ids.length ? `批量删除 (${ids.length})` : '批量删除';
}

export async function loadHistory() {
  try {
    const records = await api('/api/history');
    const container = $('historyList');
    $('historyCount').textContent = records.length ? `${records.length} 条` : '—';
    if (!records.length) { container.innerHTML = '<div class="empty-hint">暂无历史。</div>'; updateBatchButton(); return; }
    container.innerHTML = records.map((record) => `<div class="hist-item" data-id="${record.id}"><label class="h-check" title="选中以批量操作"><input type="checkbox" class="h-sel" data-id="${record.id}" /></label><div class="h-body"><div class="h-top"><span class="h-voice">${escapeHtml(record.voice || '未知音色')}</span><span class="h-time">${new Date(record.ts * 1000).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')}</span></div><div class="h-text">${escapeHtml(record.text)}</div><div class="h-actions"><button class="icon-btn play" title="播放">▶ <span>播放</span></button><a class="icon-btn dl" href="/api/history/${record.id}" download title="下载">↓ <span>下载</span></a><button class="icon-btn del" data-id="${record.id}" title="删除此条">× <span>删除</span></button></div></div></div>`).join('');
    container.querySelectorAll('.hist-item').forEach((item) => {
      item.querySelector('.play').onclick = async (event) => { event.stopPropagation(); const response = await fetch(`/api/history/${item.dataset.id}`); if (!response.ok) return toast('音频加载失败', 'err'); await playBlob(await response.blob(), records.find((record) => record.id === item.dataset.id) || { voice: item.dataset.id }); };
      item.querySelector('.del').onclick = async (event) => { event.stopPropagation(); await api(`/api/history/${item.dataset.id}`, { method: 'DELETE' }); loadHistory(); };
      item.querySelector('.h-sel').onchange = updateBatchButton;
      item.onclick = (event) => { if (event.target.closest('.h-actions') || event.target.closest('label')) return; const checkbox = item.querySelector('.h-sel'); checkbox.checked = !checkbox.checked; updateBatchButton(); };
    });
    updateBatchButton();
  } catch (error) { toast(error.message, 'err'); }
}

export async function batchDeleteHistory() {
  const ids = selectedIds();
  if (!ids.length || !window.confirm(`确定删除选中的 ${ids.length} 条历史吗?此操作不可撤销。`)) return;
  try { const result = await api('/api/history/batch-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }); toast(`已删除 ${result.deleted} 条${result.missing?.length ? `,${result.missing.length} 条未找到` : ''}`, 'ok'); loadHistory(); }
  catch (error) { toast(error.message, 'err'); }
}

export function toggleSelectAllHistory() {
  const boxes = [...document.querySelectorAll('.h-sel')];
  if (!boxes.length) return;
  const checked = boxes.every((box) => box.checked);
  boxes.forEach((box) => { box.checked = !checked; });
  updateBatchButton();
}

export function initializeHistory() {
  $('refreshHistory').onclick = loadHistory;
  $('batchDeleteHistory').onclick = batchDeleteHistory;
  $('selectAllHistory').onclick = toggleSelectAllHistory;
}
