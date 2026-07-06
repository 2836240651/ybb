"use client";

import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";

/** OMC chrome: announcement scrolls off, header remains normal sticky block. */
export function SiteChrome() {
  return (
    <>
      <AnnouncementBar />
      <Header />
    </>
  );
}
