"use client";

import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { getPageInfo } from "@/shared/utils/pageInfo";
import { translate } from "@/i18n/runtime";

/* Full-bleed heading band. With navigation on the top rail, every page opens
   with its own instrument band that spans the whole viewport width — a ticked
   ember eyebrow, a large title, a description, and a right-hand action slot.
   Pages that draw their own hero pass `bare` to suppress it. */

export default function PageHeading({
  title,
  description,
  icon,
  breadcrumbs,
  actions,
  bare = false,
  className = "",
}) {
  const pathname = usePathname();
  const info = getPageInfo(pathname);

  const resolvedTitle = title ?? info.title;
  const resolvedDescription = description ?? info.description;
  const resolvedIcon = icon ?? info.icon;
  const resolvedCrumbs = breadcrumbs ?? info.breadcrumbs;

  if (bare) return null;

  const hasCrumbs = Array.isArray(resolvedCrumbs) && resolvedCrumbs.length > 0;
  if (!resolvedTitle && !hasCrumbs) return null;

  return (
    <div className={`border-b border-border bg-surface/60 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-3.5 pt-4 lg:px-7">
        <div className="min-w-0">
          {/* Eyebrow: ember tick + crumb path, or the section label. */}
          <div className="mb-1.5 flex min-w-0 items-center gap-2">
            <span className="ember-rule-left w-5 shrink-0" aria-hidden="true" />
            {hasCrumbs ? (
              <div className="flex min-w-0 items-center gap-1.5">
                {resolvedCrumbs.map((crumb, index) => (
                  <div key={`${crumb.label}-${crumb.href || "current"}`} className="flex min-w-0 items-center gap-1.5">
                    {index > 0 && (
                      <span className="material-symbols-outlined shrink-0 text-[13px] leading-none text-text-subtle">
                        chevron_right
                      </span>
                    )}
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="truncate text-[11px] uppercase tracking-[0.06em] text-text-muted transition-colors hover:text-primary"
                      >
                        {translate(crumb.label)}
                      </Link>
                    ) : (
                      <span className="flex min-w-0 items-center gap-1.5">
                        {crumb.image && (
                          <ProviderIcon
                            src={crumb.image}
                            alt={crumb.label}
                            size={16}
                            className="max-h-[16px] max-w-[16px] shrink-0 rounded object-contain"
                            fallbackText={crumb.label.slice(0, 2).toUpperCase()}
                          />
                        )}
                        <span className="micro-label truncate">{translate(crumb.label)}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span className="micro-label truncate">{translate(resolvedTitle)}</span>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-2.5">
            {resolvedIcon && (
              <span className="material-symbols-outlined shrink-0 text-[24px] leading-none text-primary">
                {resolvedIcon}
              </span>
            )}
            <h1 className="truncate text-[21px] font-semibold leading-none tracking-tight text-text-main lg:text-[24px]">
              {translate(resolvedTitle)}
            </h1>
          </div>

          {resolvedDescription ? (
            <p className="mt-1.5 max-w-3xl text-[12.5px] leading-snug text-text-muted">
              {translate(resolvedDescription)}
            </p>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

PageHeading.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  icon: PropTypes.string,
  breadcrumbs: PropTypes.array,
  actions: PropTypes.node,
  bare: PropTypes.bool,
  className: PropTypes.string,
};
