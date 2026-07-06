"use client";

import { useEffect, useState } from "react";
import { fetchYbbJson } from "@/lib/ybb-rest";
import type { TriLabels } from "@/lib/site-manager/labels";

export type AnnouncementItem = {
  id: string;
  labels?: TriLabels;
  href: string;
};

export type AnnouncementsResponse = {
  enabled: boolean;
  items: AnnouncementItem[];
  syncedAt?: string;
};

export async function fetchAnnouncements(): Promise<AnnouncementsResponse | null> {
  return fetchYbbJson<AnnouncementsResponse>("/ybb/v1/site-manager/announcements");
}

export function useYbbAnnouncements(staticItems: AnnouncementItem[]) {
  const [items, setItems] = useState(staticItems);
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAnnouncements().then((data) => {
      if (cancelled) return;
      if (data) {
        setEnabled(data.enabled);
        if (data.items?.length) setItems(data.items);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [staticItems]);

  return { items, enabled, ready };
}
