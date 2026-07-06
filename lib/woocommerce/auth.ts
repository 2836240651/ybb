"use client";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com").replace(
  /\/$/,
  ""
);

function storeApiUrl(path: string) {
  const route = path.startsWith("/wp-json") ? path.replace(/^\/wp-json/, "") : path;
  return `${SITE}/index.php?${new URLSearchParams({ rest_route: route }).toString()}`;
}

export function wooAccountLoginUrl(redirectTo: string): string {
  const url = new URL("/my-account/", SITE);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

export function wooAccountRegisterUrl(redirectTo: string): string {
  const url = new URL("/my-account/", SITE);
  url.searchParams.set("action", "register");
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

/** Woo Store API sets User-ID: 0 for guests. */
export async function isWpCustomerLoggedIn(): Promise<boolean> {
  if (typeof document !== "undefined" && document.cookie.includes("wordpress_logged_in")) {
    return true;
  }

  try {
    const res = await fetch(storeApiUrl("/wp-json/wc/store/v1/cart"), {
      credentials: "include",
    });
    const userId = res.headers.get("User-ID");
    return Boolean(userId && userId !== "0");
  } catch {
    return false;
  }
}
