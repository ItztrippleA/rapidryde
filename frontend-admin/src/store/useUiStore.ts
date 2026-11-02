"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiState = {
  mode: "light" | "dark";
  hasHydrated: boolean;
  navOpen: boolean;
  staffId: string | null;
  toggleMode: () => void;
  setNavOpen: (open: boolean) => void;
  setStaffId: (staffId: string | null) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mode: "dark",
      hasHydrated: false,
      navOpen: false,
      staffId: null,
      toggleMode: () => set((state) => ({ mode: state.mode === "light" ? "dark" : "light" })),
      setNavOpen: (navOpen) => set({ navOpen }),
      setStaffId: (staffId) => set({ staffId }),
    }),
    {
      name: "rapyd-admin-ui",
      version: 2,
      skipHydration: true,
      partialize: (state) => ({ mode: state.mode, staffId: state.staffId }),
      migrate: (persisted, version) => {
        const saved = (persisted ?? {}) as { mode?: "light" | "dark"; staffId?: string | null };
        const next = { ...saved };
        if (version < 1) next.mode = "dark";
        if (version < 2) next.staffId = null;
        return next;
      },
    },
  ),
);
