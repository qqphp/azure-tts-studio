import { $, formatTime, state } from './core.js';

const playIcon = () => '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const pauseIcon = () => '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';

function stopCurrentAudio() {
  if (!state.currentAudio) return;
  state.currentAudio.pause();
  URL.revokeObjectURL(state.currentAudio.src);
}

function attachAudio(audio, blob, meta) {
  stopCurrentAudio();
  state.currentAudio = audio;
  state.currentBlob = blob;
  state.currentMeta = meta;
  audio.addEventListener('timeupdate', () => {
    $('playerTime').textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  });
  audio.addEventListener('play', () => { $('playerBar').classList.add('playing'); $('playToggle').innerHTML = pauseIcon(); });
  audio.addEventListener('pause', () => { $('playerBar').classList.remove('playing'); $('playToggle').innerHTML = playIcon(); });
  audio.addEventListener('ended', () => { $('playerBar').classList.remove('playing'); $('playToggle').innerHTML = playIcon(); });
  $('playerTitle').textContent = meta.voice || '未命名音频';
  $('playerBar').classList.remove('hidden');
}

export function playBlob(blob, meta) {
  const audio = new Audio(URL.createObjectURL(blob));
  attachAudio(audio, blob, meta);
  return audio.play();
}

export function playAudio(base64, mime, meta) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return playBlob(new Blob([bytes], { type: mime }), meta);
}

export function togglePlayback() {
  if (!state.currentAudio) return;
  if (state.currentAudio.paused) state.currentAudio.play();
  else state.currentAudio.pause();
}

export function downloadCurrentAudio() {
  if (!state.currentBlob) return;
  const format = state.currentMeta?.format || '';
  const extension = format.includes('mp3') ? 'mp3' : format.includes('ogg') ? 'ogg' : format.includes('webm') ? 'webm' : 'wav';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(state.currentBlob);
  link.download = `tts_${state.currentMeta?.id || Date.now()}.${extension}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function initializePlayer() {
  $('playToggle').onclick = togglePlayback;
}
