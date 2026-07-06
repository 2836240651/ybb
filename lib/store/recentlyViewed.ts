import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "ybb-recently-viewed";
const MAX_ITEMS = 12;

export type RecentlyViewedEntry = {
  handle: string;
  viewedAt: number;
};

type RecentlyViewedState = {
  handles: RecentlyViewedEntry[];
  recordView: (handle: string) => void;
  getHandles: () => string[];
  clear: () => void;
};

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      handles: [],
      recordView: (handle) => {
        const trimmed = handle.trim();
        if (!trimmed) return;
        set((state) => {
          const next = [
            { handle: trimmed, viewedAt: Date.now() },
            ...state.handles.filter((e) => e.handle !== trimmed),
          ].slice(0, MAX_ITEMS);
          return { handles: next };
        });
      },
      getHandles: () => get().handles.map((e) => e.handle),
      clear: () => set({ handles: [] }),
    }),
    { name: STORAGE_KEY }
  )
);

/** Mock handles shown when the visitor has no browsing history yet. */
export const RECENTLY_VIEWED_MOCK_HANDLES = [
  "three-way-swivel-kit-box",
  "three-way-swivel-kit-box-integrated",
  "stripped-line-bait-cage-balance",
  "tackle-bag",
  "shot",
  "water-weight",
  "lead-weight-swivel-fish-scale",
  "tiger-nut",
  "stand-wrench",
] as const;
