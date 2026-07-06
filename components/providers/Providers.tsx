"use client";

import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ScrollRevealProvider } from "@/components/motion/ScrollRevealProvider";
import { HardNavCapture } from "@/lib/navigation/HardNavCapture";
import { NavigationProvider } from "@/lib/site-manager/NavigationProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <NavigationProvider>
        <HardNavCapture />
        <ScrollRevealProvider>{children}</ScrollRevealProvider>
      </NavigationProvider>
    </I18nProvider>
  );
}
