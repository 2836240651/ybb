"use client";

import Link from "next/link";
import {
  getOtherChildCategories,
  isOtherChildHandle,
  resolveCategoryNavActive,
} from "@/lib/data/catalog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type OtherSubNavProps = {
  activeHandle: string;
  className?: string;
};

function SubLabel({ titleEn, titleCn }: { titleEn: string; titleCn: string }) {
  const { locale } = useI18n();
  return <>{locale === "zh" ? titleCn : titleEn}</>;
}

export function OtherSubNav({ activeHandle, className }: OtherSubNavProps) {
  const { t } = useI18n();
  const tab = resolveCategoryNavActive(activeHandle);
  if (tab !== "other") return null;

  const children = getOtherChildCategories();
  const activeChild = isOtherChildHandle(activeHandle) ? activeHandle : null;

  return (
    <nav
      className={cn("other-sub-nav", className)}
      aria-label={t("catalog.otherSubcategories")}
    >
      <ul className="other-sub-nav__list">
        <li>
          <Link
            href="/collections/other"
            className={cn(
              "other-sub-nav__link",
              !activeChild && "other-sub-nav__link--active"
            )}
            aria-current={!activeChild ? "page" : undefined}
          >
            {t("catalog.allOther")}
          </Link>
        </li>
        {children.map((child) => (
          <li key={child.handle}>
            <Link
              href={`/collections/${child.handle}`}
              className={cn(
                "other-sub-nav__link",
                activeChild === child.handle && "other-sub-nav__link--active"
              )}
              aria-current={activeChild === child.handle ? "page" : undefined}
            >
              <SubLabel titleEn={child.titleEn} titleCn={child.titleCn} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
