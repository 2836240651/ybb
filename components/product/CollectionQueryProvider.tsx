"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  countActiveFilters,
  type CollectionFilterParams,
} from "@/lib/collection-filters";

type CollectionQueryContextValue = {
  filters: CollectionFilterParams;
  sort: string;
  page: number;
  activeFilterCount: number;
  setParam: (key: keyof CollectionFilterParams, value: string) => void;
  updateSort: (value: string) => void;
  clearFilters: () => void;
  goToPage: (page: number) => void;
};

const CollectionQueryContext = createContext<CollectionQueryContextValue | null>(
  null
);

function parsePage(raw: string | null): number {
  const n = Number(raw ?? "1");
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function CollectionQueryInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryString = (searchParams ?? new URLSearchParams()).toString();

  const filters: CollectionFilterParams = useMemo(() => {
    const params = new URLSearchParams(queryString);
    return {
      sort: params.get("sort") ?? undefined,
      availability: params.get("availability") ?? undefined,
      price: params.get("price") ?? undefined,
      tag: params.get("tag") ?? undefined,
    };
  }, [queryString]);

  const sort = filters.sort ?? "featured";
  const page = useMemo(() => {
    const params = new URLSearchParams(queryString);
    return parsePage(params.get("page"));
  }, [queryString]);
  const activeFilterCount = countActiveFilters(filters);

  const pushQuery = useCallback(
    (mutate: (params: URLSearchParams) => void, scroll = false) => {
      const next = new URLSearchParams(
        (searchParams ?? new URLSearchParams()).toString()
      );
      mutate(next);
      const qs = next.toString();
      router.push(qs ? `?${qs}` : "?", { scroll });
    },
    [router, searchParams]
  );

  const setParam = useCallback(
    (key: keyof CollectionFilterParams, value: string) => {
      pushQuery((params) => {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
        params.delete("page");
      });
    },
    [pushQuery]
  );

  const updateSort = useCallback(
    (value: string) => {
      pushQuery((params) => {
        if (!value || value === "featured") {
          params.delete("sort");
        } else {
          params.set("sort", value);
        }
        params.delete("page");
      });
    },
    [pushQuery]
  );

  const clearFilters = useCallback(() => {
    pushQuery((params) => {
      params.delete("availability");
      params.delete("price");
      params.delete("tag");
      params.delete("page");
    });
  }, [pushQuery]);

  const goToPage = useCallback(
    (nextPage: number) => {
      pushQuery((params) => {
        if (nextPage <= 1) {
          params.delete("page");
        } else {
          params.set("page", String(nextPage));
        }
      }, true);
    },
    [pushQuery]
  );

  const value = useMemo(
    () => ({
      filters,
      sort,
      page,
      activeFilterCount,
      setParam,
      updateSort,
      clearFilters,
      goToPage,
    }),
    [
      filters,
      sort,
      page,
      activeFilterCount,
      setParam,
      updateSort,
      clearFilters,
      goToPage,
    ]
  );

  return (
    <CollectionQueryContext.Provider value={value}>
      {children}
    </CollectionQueryContext.Provider>
  );
}

export function CollectionQueryProvider({ children }: { children: ReactNode }) {
  return <CollectionQueryInner>{children}</CollectionQueryInner>;
}

export function useCollectionQuery(): CollectionQueryContextValue {
  const ctx = useContext(CollectionQueryContext);
  if (!ctx) {
    throw new Error(
      "useCollectionQuery must be used within CollectionQueryProvider"
    );
  }
  return ctx;
}
