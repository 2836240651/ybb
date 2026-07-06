"use client";

import { useEffect } from "react";
import { latestStoriesHydrateScriptUrl } from "@/lib/latest-stories";

const SCRIPT_ID = "ybb-latest-stories-hydrate";

export function LatestStoriesRuntime() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = latestStoriesHydrateScriptUrl();
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}
