"use client";

import { useEffect } from "react";
import { useRecentlyViewed } from "@/lib/store/recentlyViewed";

type RecordRecentlyViewedProps = {
  handle: string;
};

/** Persists PDP visits to localStorage for the home Recently Viewed carousel. */
export function RecordRecentlyViewed({ handle }: RecordRecentlyViewedProps) {
  const recordView = useRecentlyViewed((s) => s.recordView);

  useEffect(() => {
    recordView(handle);
  }, [handle, recordView]);

  return null;
}
