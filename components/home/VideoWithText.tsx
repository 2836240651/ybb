"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { WhatsAppPill } from "@/components/layout/WhatsAppPill";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { resolveTriLabel } from "@/lib/site-manager/labels";
import { useYbbFactoryVideo } from "@/lib/site-manager/home-modules-api";
import { cn } from "@/lib/utils";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com";

const FALLBACK_TITLE = "Precision Manufacturing. Reliable Quality.";
const FALLBACK_BODY =
  "From raw materials to final inspection, every product is manufactured under strict quality control. With advanced production lines, experienced technicians, and flexible OEM & ODM services, we help fishing brands deliver reliable tackle trusted by anglers worldwide.";
const FALLBACK_CTA = "Request a Quote";

function toMediaSrc(url: string): string {
  const base = SITE.replace(/\/$/, "");
  if (url.startsWith(base)) return url.slice(base.length) || "/";
  return url.startsWith("/") ? url : `/${url}`;
}

function VideoTextSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-9 w-4/5 max-w-md animate-pulse rounded-md bg-neutral-200" />
      <div className="space-y-3 max-w-prose">
        <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
        <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-12 w-40 animate-pulse rounded-button bg-neutral-200" />
        <div className="h-12 w-36 animate-pulse rounded-button bg-neutral-200" />
      </div>
    </div>
  );
}

export function VideoWithText() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const { locale } = useI18n();
  const { data, ready } = useYbbFactoryVideo();

  const videoUrl = data?.videoUrl ? toMediaSrc(data.videoUrl) : "/videos/factory-showcase.mp4";

  const title = ready
    ? resolveTriLabel(data?.labels?.title, locale, data?.labels?.title?.en || FALLBACK_TITLE)
    : "";
  const body = ready
    ? resolveTriLabel(data?.labels?.body, locale, data?.labels?.body?.en || FALLBACK_BODY)
    : "";
  const cta = ready
    ? resolveTriLabel(data?.labels?.cta, locale, data?.labels?.cta?.en || FALLBACK_CTA)
    : "";

  if (ready && data && !data.enabled) return null;

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  return (
    <section
      className="page-container"
      aria-labelledby={ready ? "factory-video-heading" : undefined}
      aria-busy={!ready}
    >
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <ScrollReveal animate="zoom-out" className="relative aspect-video rounded-card overflow-hidden bg-neutral-900">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            preload="metadata"
            poster={data?.posterUrl ? toMediaSrc(data.posterUrl) : undefined}
            onEnded={() => setPlaying(false)}
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
          <div
            className={cn(
              "absolute inset-0 bg-neutral-900/25 transition-opacity duration-500 ease-primary",
              playing && "opacity-0 pointer-events-none"
            )}
          />
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause factory video" : "Play factory video"}
            className="absolute inset-0 flex items-center justify-center group"
          >
            <span
              className={cn(
                "inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-foreground shadow-lg transition-transform duration-500 ease-primary group-hover:scale-105",
                playing && "opacity-0 scale-90 pointer-events-none"
              )}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        </ScrollReveal>

        <div>
          {!ready ? (
            <VideoTextSkeleton />
          ) : (
            <>
              <ScrollReveal animate="fade-up-large" delay={0}>
                <h2 id="factory-video-heading" className="text-title-md mb-6">
                  {title}
                </h2>
              </ScrollReveal>
              <ScrollReveal animate="fade-up" delay={80}>
                <p className="text-foreground/80 leading-relaxed mb-8 max-w-prose">{body}</p>
              </ScrollReveal>
              <ScrollReveal animate="fade-up" delay={160}>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/pages/contact"
                    className="inline-flex items-center justify-center rounded-button border border-foreground bg-background px-8 py-3 text-sm font-medium text-foreground interaction-fill-button"
                  >
                    <span className="relative z-[1]">{cta}</span>
                  </Link>
                  <WhatsAppPill className="px-8 py-3" />
                </div>
              </ScrollReveal>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
