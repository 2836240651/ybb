import type { ComponentType } from "react";

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M14 8h2.5V5h-2.5C12.57 5 11 6.57 11 8.5V11H8v3h3v7h3v-7h2.6l.4-3H14V9.5c0-.83.67-1.5 1.5-1.5z" />
    </svg>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.09 5 12 5 12 5s-6.09 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.91 19 12 19 12 19s6.09 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z" />
    </svg>
  );
}

export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.5 3c.3 2.2 1.5 4 3.5 5.1v3.2c-1.4 0-2.7-.4-3.8-1.1v5.6c0 3.4-2.8 6.2-6.2 6.2S3.8 18.2 3.8 14.8s2.8-6.2 6.2-6.2c.3 0 .7 0 1 .1v3.4c-.3-.1-.7-.1-1-.1-1.6 0-2.9 1.3-2.9 2.9s1.3 2.9 2.9 2.9 2.9-1.3 2.9-2.9V3h3.8z" />
    </svg>
  );
}

export function SnapchatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2c2.8 0 5 2.2 5 5.1 0 .5-.1 1-.2 1.4 2.1.5 3.7 2.4 3.7 4.7 0 .8-.2 1.5-.5 2.2.8.3 1.4.8 1.8 1.5.5.9.5 2-.1 2.9-.4.6-1 1.1-1.7 1.3-.2 1.1-.9 2-1.9 2.5-.8.4-1.7.5-2.6.3-.8 1.1-2.1 1.8-3.5 1.8s-2.7-.7-3.5-1.8c-.9.2-1.8.1-2.6-.3-1-.5-1.7-1.4-1.9-2.5-.7-.2-1.3-.7-1.7-1.3-.6-.9-.6-2-.1-2.9.4-.7 1-1.2 1.8-1.5-.3-.7-.5-1.4-.5-2.2 0-2.3 1.6-4.2 3.7-4.7-.1-.4-.2-.9-.2-1.4C7 4.2 9.2 2 12 2z" />
    </svg>
  );
}

export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.3 3h3.2l-7 8.1L21.5 21h-6.2l-4.8-6.3L4.8 21H1.6l7.5-8.6L2.5 3h6.3l4.3 5.7L17.3 3zm-1.1 16.2h1.8L7.1 4.7H5.2l11 14.5z" />
    </svg>
  );
}

export const SOCIAL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Facebook: FacebookIcon,
  Snapchat: SnapchatIcon,
  Instagram: InstagramIcon,
  TikTok: TikTokIcon,
  X: XIcon,
};
