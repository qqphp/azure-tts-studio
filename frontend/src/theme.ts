export const DEFAULT_THEME = 'morning-tea';

export const themes = [
  { id: 'morning-tea', name: '晨雾白茶', description: '雾白与柔和茶绿，轻松、清透、很耐看。', colors: ['#f6f7f3', '#5a9c82', '#ddeee5'] },
  { id: 'sea-salt', name: '海盐晴空', description: '晴空蓝与海盐白，像一个明亮安静的早晨。', colors: ['#f4f8fa', '#5e9db6', '#ddeef4'] },
  { id: 'celadon-spring', name: '春日青瓷', description: '青瓷绿轻轻铺开，温柔而有呼吸感。', colors: ['#f3f8f4', '#70a98a', '#d7eadf'] },
  { id: 'violet-letter', name: '淡紫信笺', description: '纸张般的淡紫与灰蓝，优雅、克制、柔和。', colors: ['#f8f6fb', '#907ab9', '#e6dff3'] },
  { id: 'almond-light', name: '奶杏微光', description: '暖杏与浅金交织，柔软、明净、不甜腻。', colors: ['#fcf8f2', '#b98762', '#f1e0d0'] },
] as const;

export type ThemeId = typeof themes[number]['id'];

export function isTheme(value: string | undefined): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function applyTheme(value: string | undefined) {
  document.documentElement.dataset.theme = isTheme(value) ? value : DEFAULT_THEME;
}
