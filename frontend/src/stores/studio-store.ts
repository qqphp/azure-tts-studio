import { create } from 'zustand';
import type { Voice } from '../types/api';

interface StudioState {
  selectedVoice: Voice | null;
  text: string;
  setVoice: (voice: Voice | null) => void;
  setText: (text: string) => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  selectedVoice: null,
  text: '',
  setVoice: (selectedVoice) => set({ selectedVoice }),
  setText: (text) => set({ text }),
}));
