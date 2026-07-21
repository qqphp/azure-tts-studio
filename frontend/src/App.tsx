import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';

const StudioPage = lazy(() => import('./pages/StudioPage').then((module) => ({ default: module.StudioPage })));
const EditorPage = lazy(() => import('./pages/EditorPage').then((module) => ({ default: module.EditorPage })));
const VoicesPage = lazy(() => import('./pages/VoicesPage').then((module) => ({ default: module.VoicesPage })));
const SoundEffectsPage = lazy(() => import('./pages/SoundEffectsPage').then((module) => ({ default: module.SoundEffectsPage })));
const BackgroundMusicPage = lazy(() => import('./pages/BackgroundMusicPage').then((module) => ({ default: module.BackgroundMusicPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

const page = (Page: LazyExoticComponent<ComponentType>) => <Suspense fallback={<p className="state-message">正在加载页面…</p>}><Page /></Suspense>;

export function App() { return <Routes><Route element={<AppShell />}><Route index element={page(StudioPage)} /><Route path="editor" element={page(EditorPage)} /><Route path="voices" element={page(VoicesPage)} /><Route path="sound-effects" element={page(SoundEffectsPage)} /><Route path="background-music" element={page(BackgroundMusicPage)} /><Route path="history" element={page(HistoryPage)} /><Route path="settings" element={page(SettingsPage)} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes>; }
