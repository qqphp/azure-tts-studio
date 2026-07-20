/** Hash-based page router, independent from synthesis feature code. */
const pages = new Set(['studio', 'voices', 'history']);
const titles = { studio: '工作台', voices: '音色中心', history: '历史记录' };

function currentPage() {
  const value = window.location.hash.slice(1).toLowerCase();
  return pages.has(value) ? value : 'studio';
}

function renderPage() {
  const page = currentPage();
  const workspace = document.getElementById('workspace');
  if (!workspace) return;
  workspace.dataset.page = page;
  document.querySelectorAll('[data-page-link]').forEach((link) => {
    const active = link.dataset.pageLink === page;
    link.classList.toggle('active', active);
    link.toggleAttribute('aria-current', active);
    if (active) link.setAttribute('aria-current', 'page');
  });
  document.title = `${titles[page]} · Azure 配音工坊`;
  document.dispatchEvent(new CustomEvent('tts:page-change', { detail: { page } }));
}

window.addEventListener('hashchange', renderPage);
if (!window.location.hash) window.history.replaceState(null, '', '#studio');
renderPage();
