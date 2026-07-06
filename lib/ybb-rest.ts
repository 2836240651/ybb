"use client";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com";

function restBase(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return SITE.replace(/\/$/, "");
}

export function ybbRestUrl(route: string): string {
  const normalized = route.startsWith("/") ? route : `/${route}`;
  const base = restBase();

  return `${base}/wp-json${normalized}`;
}

export function ybbLegacyRestUrl(route: string): string {
  const normalized = route.startsWith("/") ? route : `/${route}`;
  const base = `${restBase()}/index.php`;

  return `${base}?${new URLSearchParams({
    rest_route: normalized,
    _: String(Date.now()),
  }).toString()}`;
}

async function parseYbbJson<T>(res: Response): Promise<T | null> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchYbbJson<T>(route: string): Promise<T | null> {
  const urls = [ybbRestUrl(route), ybbLegacyRestUrl(route)];
  const init: RequestInit = {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  };

  for (const url of urls) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        continue;
      }
      const data = await parseYbbJson<T>(res);
      if (data !== null) {
        return data;
      }
    } catch {
      // try next URL
    }
  }

  return null;
}
