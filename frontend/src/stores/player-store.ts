import { create } from 'zustand';

interface PlayerState {
  source: string | null;
  title: string;
  setTrack: (source: string, title: string) => void;
  clear: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  source: null,
  title: '',
  setTrack: (source, title) => set({ source, title }),
  clear: () => set({ source: null, title: '' }),
}));
