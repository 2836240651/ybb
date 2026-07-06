import { create } from "zustand";

type UIState = {
  searchOpen: boolean;
  mobileNavOpen: boolean;
  filterOpen: boolean;
  quickViewHandle: string | null;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
  openFilter: () => void;
  closeFilter: () => void;
  openQuickView: (handle: string) => void;
  closeQuickView: () => void;
};

export const useUI = create<UIState>((set) => ({
  searchOpen: false,
  mobileNavOpen: false,
  filterOpen: false,
  quickViewHandle: null,
  openSearch: () => set({ searchOpen: true, mobileNavOpen: false }),
  closeSearch: () => set({ searchOpen: false }),
  toggleSearch: () =>
    set((s) => ({ searchOpen: !s.searchOpen, mobileNavOpen: false })),
  openMobileNav: () => set({ mobileNavOpen: true, searchOpen: false }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  toggleMobileNav: () =>
    set((s) => ({ mobileNavOpen: !s.mobileNavOpen, searchOpen: false })),
  openFilter: () => set({ filterOpen: true }),
  closeFilter: () => set({ filterOpen: false }),
  openQuickView: (handle) => set({ quickViewHandle: handle }),
  closeQuickView: () => set({ quickViewHandle: null }),
}));
