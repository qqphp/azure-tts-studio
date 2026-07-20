import { $ } from './core.js';

export function currentTheme() {
  return localStorage.getItem('theme') || 'system';
}

export function setTheme(theme) {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeSwitch();
}

export function updateThemeSwitch() {
  const active = currentTheme();
  document.querySelectorAll('.theme-switch .seg').forEach((button) => {
    button.classList.toggle('active', button.dataset.theme === active);
  });
}

export function initializeTheme() {
  updateThemeSwitch();
  document.querySelectorAll('.theme-switch .seg').forEach((button) => {
    button.onclick = () => setTheme(button.dataset.theme);
  });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (currentTheme() === 'system') updateThemeSwitch();
  });
}
