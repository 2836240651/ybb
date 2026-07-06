"use client";

import { useEffect, useState } from "react";
import { fetchYbbJson } from "@/lib/ybb-rest";

export function useYbbConfig<T>(route: string, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchYbbJson<T>(route)
      .then((res) => {
        if (cancelled) return;
        if (res !== null) setData(res);
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "fetch failed");
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [route]);

  return { data, ready, error };
}
