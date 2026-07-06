"use client";

import type { Locale } from "@/lib/i18n/locales";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com";

export type ContactSubject = "wholesale" | "oem" | "samples" | "other";

export type ContactInquiryPayload = {
  name: string;
  email: string;
  company: string;
  subject: ContactSubject;
  message: string;
  locale: Locale;
  /** Honeypot �?must stay empty */
  website?: string;
};

function contactApiUrl(): string {
  const base = `${SITE.replace(/\/$/, "")}/index.php`;
  return `${base}?${new URLSearchParams({ rest_route: "/ybb/v1/contact-inquiry" }).toString()}`;
}

export async function submitContactInquiry(
  payload: ContactInquiryPayload
): Promise<void> {
  const res = await fetch(contactApiUrl(), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    return;
  }

  let detail = "";
  try {
    const json = (await res.json()) as { message?: string; code?: string };
    detail = json.message || json.code || "";
  } catch {
    detail = await res.text().catch(() => "");
  }

  const err = new Error(detail || `HTTP ${res.status}`);
  (err as Error & { status?: number }).status = res.status;
  throw err;
}
