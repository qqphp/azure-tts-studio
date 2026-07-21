import { Music2 } from 'lucide-react';
import { api } from '../services/api';
import { AudioLibraryPage, type AudioLibraryConfig } from './SoundEffectsPage';

const backgroundMusicConfig: AudioLibraryConfig = {
  queryKey: 'background-music',
  noun: '背景音乐',
  title: '背景音乐',
  eyebrow: 'BACKGROUND MUSIC LIBRARY',
  description: '集中管理专业配音中使用的氛围音乐、片头片尾和其他背景音乐素材。',
  icon: Music2,
  categoryPlaceholder: '例如：轻音乐、影视、氛围、片头片尾',
  templateFileName: '背景音乐导入模板.xlsx',
  dataFileName: '背景音乐数据.xlsx',
  sheetName: '背景音乐数据',
  list: api.backgroundMusic,
  create: api.createBackgroundMusic,
  update: api.updateBackgroundMusic,
  remove: api.deleteBackgroundMusic,
  batchRemove: api.deleteBackgroundMusicBatch,
};

export function BackgroundMusicPage() {
  return <AudioLibraryPage config={backgroundMusicConfig} />;
}
