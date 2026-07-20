/** Shared browser primitives. Feature modules import from here instead of app.js. */
export const $ = (id) => document.getElementById(id);

export const state = {
  voices: [],
  selectedVoice: null,
  mode: 'quick',
  ssmlValid: false,
  currentAudio: null,
  currentBlob: null,
  currentMeta: null,
  historyLoaded: false,
};

export async function api(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      message = payload.detail || payload.message || message;
    } catch { /* Non-JSON error responses keep their HTTP status message. */ }
    throw new Error(message);
  }
  return (response.headers.get('content-type') || '').includes('application/json')
    ? response.json()
    : response;
}

export function toast(message, type = '') {
  const element = $('toast');
  element.textContent = message;
  element.className = `toast ${type}`;
  window.setTimeout(() => element.classList.add('hidden'), 2200);
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function setConnection(status, label) {
  const element = $('connStatus');
  element.className = `status-chip ${status}`;
  element.querySelector('.label').textContent = label;
}
