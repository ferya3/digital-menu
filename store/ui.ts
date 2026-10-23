import { create } from "zustand";

interface UIState {
  menuOpen: boolean;
  setMenu: (v: boolean) => void;
  toggle: () => void;
  /** "Barista's picks" panel */
  picksOpen: boolean;
  setPicks: (v: boolean) => void;
  /** Welcome splash (hero) — only the first time in each session */
  splash: boolean;
  setSplash: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  menuOpen: false,
  setMenu: (v) => set({ menuOpen: v }),
  toggle: () => set((s) => ({ menuOpen: !s.menuOpen })),
  picksOpen: false,
  setPicks: (v) => set({ picksOpen: v }),
  splash: true,
  setSplash: (v) => set({ splash: v }),
}));
