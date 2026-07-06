"use client";

import { useEffect } from "react";
import { hotProductsHydrateScriptUrl } from "@/lib/hot-products";

const SCRIPT_ID = "ybb-hot-products-hydrate";

export function HotProductsRuntime() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = hotProductsHydrateScriptUrl();
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}
