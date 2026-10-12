import { create } from "zustand";

interface UIState {
  menuOpen: boolean;
  setMenu: (v: boolean) => void;
  toggle: () => void;
}

export const useUI = create<UIState>((set) => ({
  menuOpen: false,
  setMenu: (v) => set({ menuOpen: v }),
  toggle: () => set((s) => ({ menuOpen: !s.menuOpen })),
}));
