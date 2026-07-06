"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice, products } from "@/lib/data/products";
import { useI18n, useProductTitle } from "@/lib/i18n/I18nProvider";
import { useUI } from "@/lib/store/ui";
import type { Product } from "@/lib/types/product";
import { cn } from "@/lib/utils";

const RECENT_KEY = "ybb-search-recent";
const MAX_RECENT = 5;

function searchProducts(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products
    .filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.titleCn?.toLowerCase().includes(q) ||
        p.tags.some((tag) => tag.toLowerCase().includes(q))
    )
    .slice(0, 12);
}

function suggestQueries(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const fromTitles = products
    .filter((p) => p.title.toLowerCase().includes(q))
    .map((p) => p.title)
    .slice(0, 4);

  const fromTags = products
    .flatMap((p) => p.tags)
    .filter((tag) => tag.toLowerCase().includes(q))
    .map((tag) => tag.replace(/-/g, " "))
    .slice(0, 3);

  return [...new Set([...fromTitles, ...fromTags])].slice(0, 6);
}

const QUICK_QUERY_KEYS = [
  "new-arrivals",
  "hooks",
  "method-feeder",
  "ready-rigs",
  "braided-line",
] as const;

const TRENDING_QUERY_KEYS = [
  "swivel-kit",
  "bait-cage",
  "ronnie-rig",
  "terminal-tackle",
  "aligner",
] as const;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeRecent(items: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}

function SearchResultItem({
  product,
  onSelect,
}: {
  product: Product;
  activeQuery: string;
  onSelect: () => void;
}) {
  const title = useProductTitle(product);

  return (
    <li>
      <Link
        href={`/products/${product.handle}`}
        onClick={onSelect}
        className="flex gap-4 rounded-card border border-border p-3 hover:bg-neutral-50 transition-colors"
      >
        <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded bg-neutral-100">
          <Image
            src={product.images[0]}
            alt={title}
            fill
            sizes="56px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium line-clamp-2">{title}</p>
          <p className="text-sm font-medium mt-1">
            {formatPrice(product.price)}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function SearchDrawer() {
  const { searchOpen, closeSearch } = useUI();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchProducts(query), [query]);
  const suggestions = useMemo(() => suggestQueries(query), [query]);
  const activeQuery = query.trim();

  useEffect(() => {
    document.body.style.overflow = searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      setQuery("");
      setRecent(readRecent());
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    if (searchOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, closeSearch]);

  function rememberQuery(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recent.filter((r) => r !== trimmed)].slice(
      0,
      MAX_RECENT
    );
    setRecent(next);
    writeRecent(next);
  }

  function applyQuery(value: string) {
    setQuery(value);
    inputRef.current?.focus();
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          searchOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!searchOpen}
        onClick={closeSearch}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("search.title")}
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-500 ease-nav",
          searchOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              className="flex-1 border border-border rounded-input px-4 py-3 text-base outline-none focus:border-foreground/30"
              aria-label={t("search.title")}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={closeSearch}
              className="rounded-full p-2 interaction-icon-hover transition-colors shrink-0"
              aria-label={t("search.close")}
            >
              �?            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {query.trim() === "" ? (
            <div className="py-4 space-y-6">
              <p className="text-sm text-foreground/50">
                {t("search.hint")}
              </p>

              {recent.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-foreground/50 mb-2">
                    {t("search.recent")}
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {recent.map((item) => (
                      <li key={item}>
                        <button
                          type="button"
                          onClick={() => applyQuery(item)}
                          className="rounded-pill border border-border px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors"
                        >
                          {item}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-wide text-foreground/50 mb-2">
                  {t("search.trending")}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {TRENDING_QUERY_KEYS.map((key) => (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => applyQuery(t(`search.queries.${key}`))}
                        className="rounded-pill border border-border px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors"
                      >
                        {t(`search.queries.${key}`)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-foreground/50 mb-2">
                  {t("search.popularCategories")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUERY_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyQuery(t(`search.queries.${key}`))}
                      className="rounded-pill border border-border px-3 py-1.5 text-xs hover:bg-neutral-50 transition-colors"
                    >
                      {t(`search.queries.${key}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 space-y-4">
              <p className="text-sm text-foreground/60 text-center">
                {t("search.noResults", { query })}
              </p>
              {suggestions.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-foreground/50 mb-2">
                    {t("search.didYouMean")}
                  </p>
                  <ul className="flex flex-wrap gap-2 justify-center">
                    {suggestions.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => applyQuery(s)}
                          className="rounded-pill border border-border px-3 py-1.5 text-xs hover:bg-neutral-50"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.length > 0 && (
                <ul className="flex flex-wrap gap-2 pb-2 border-b border-border">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => applyQuery(s)}
                        className="rounded-pill bg-neutral-100 px-3 py-1 text-xs hover:bg-neutral-200 transition-colors"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs uppercase tracking-wide text-foreground/50">
                {t("search.resultsCount", {
                  count: results.length,
                  query: activeQuery,
                })}
              </p>
              <ul className="flex flex-col gap-3">
                {results.map((product) => (
                  <SearchResultItem
                    key={product.handle}
                    product={product}
                    activeQuery={activeQuery}
                    onSelect={() => {
                      rememberQuery(activeQuery);
                      closeSearch();
                    }}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
