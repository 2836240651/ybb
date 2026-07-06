"use client";

import type { ReactNode } from "react";
import { OtherSubNav } from "./OtherSubNav";
import {
  catalogNavHandles,
  isOtherChildHandle,
  resolveCategoryNavActive,
} from "@/lib/data/catalog";

type CatalogCategoryShellProps = {
  activeHandle: string;
  children: ReactNode;
};

export function CatalogCategoryShell({
  activeHandle,
  children,
}: CatalogCategoryShellProps) {
  const showCatalogNav =
    activeHandle === "all" ||
    catalogNavHandles.includes(activeHandle) ||
    isOtherChildHandle(activeHandle);

  if (!showCatalogNav) {
    return <>{children}</>;
  }

  const showOtherSubNav = resolveCategoryNavActive(activeHandle) === "other";

  if (!showOtherSubNav) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="page-container pt-6 md:pt-8">
        <OtherSubNav activeHandle={activeHandle} />
      </div>
      {children}
    </>
  );
}
