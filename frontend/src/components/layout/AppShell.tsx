import { AudioLines, Github, History, MessageCircle, Mic2, Music2, Settings, SlidersHorizontal, Sparkles, Volume2 } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { AudioPlayer } from '../audio/AudioPlayer';
import { usePlayerStore } from '../../stores/player-store';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../../services/api';
import { applyTheme } from '../../theme';

const navItems = [
  { to: '/', label: '快速配音', icon: Mic2, end: true },
  { to: '/editor', label: '专业配音', icon: SlidersHorizontal },
  { to: '/voices', label: '音色中心', icon: Volume2 },
  { to: '/sound-effects', label: '音效中心', icon: AudioLines },
  { to: '/background-music', label: '背景音乐', icon: Music2 },
  { to: '/history', label: '历史配音', icon: History },
];

export function AppShell() {
  const hasAudioPlayer = usePlayerStore((state) => Boolean(state.source));
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  useEffect(() => applyTheme(settings?.theme), [settings?.theme]);
  return <div className={`app-shell ${hasAudioPlayer ? 'has-audio-player' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>大风车配音工坊</span></div>
      <nav className="navigation" aria-label="主导航">
        {navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon size={18} /><span>{label}</span>
        </NavLink>)}
      </nav>
      <section className="sidebar-community" aria-label="项目社区">
        <div className="sidebar-community-heading"><Sparkles size={13} /><span>一起交流</span></div>
        <div className="sidebar-community-item" title="QQ 交流群：581711375">
          <MessageCircle size={17} />
          <span><small>QQ 交流群</small><b>581711375</b></span>
        </div>
        <a className="sidebar-community-item" href="https://github.com/qqphp/Azure_TTS" target="_blank" rel="noreferrer">
          <Github size={17} />
          <span><small>GitHub 地址</small><b>qqphp/Azure_TTS</b></span>
        </a>
      </section>
      <NavLink to="/settings" className={({ isActive }) => `nav-item nav-settings ${isActive ? 'active' : ''}`}><Settings size={18} /><span>设置</span></NavLink>
    </aside>
    <main className="page-content"><Outlet /></main><AudioPlayer />
  </div>;
}
