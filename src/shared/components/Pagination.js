"use client";

import { cn } from "@/shared/utils/cn";
import Button from "./Button";

export default function Pagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const showMax = 5;
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + showMax - 1);
    if (end - start + 1 < showMax) start = Math.max(1, end - showMax + 1);

    const pages = [];
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const gap = <span className="px-1 text-text-subtle hidden sm:inline">…</span>;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-border-subtle",
        className
      )}
    >
      {totalItems > 0 && (
        <p className="text-xs text-text-subtle">
          <span className="font-medium text-text-main tabular-nums">{startItem}</span>
          {"–"}
          <span className="font-medium text-text-main tabular-nums">{endItem}</span>
          {" of "}
          <span className="font-medium text-text-main tabular-nums">{totalItems}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span className="text-xs text-text-subtle">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="field-control h-7 pl-2 pr-1 text-xs cursor-pointer"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-7 px-0"
              aria-label="Previous page"
            >
              <span className="material-symbols-outlined text-[16px] leading-none">chevron_left</span>
            </Button>

            {pageNumbers[0] > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPageChange(1)}
                  className="w-7 px-0 hidden sm:inline-flex tabular-nums"
                >
                  1
                </Button>
                {pageNumbers[0] > 2 && gap}
              </>
            )}

            {pageNumbers.map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "primary" : "ghost"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={cn(
                  "w-7 px-0 tabular-nums",
                  currentPage === page ? "inline-flex" : "hidden sm:inline-flex"
                )}
              >
                {page}
              </Button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && gap}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPageChange(totalPages)}
                  className="w-7 px-0 hidden sm:inline-flex tabular-nums"
                >
                  {totalPages}
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-7 px-0"
              aria-label="Next page"
            >
              <span className="material-symbols-outlined text-[16px] leading-none">chevron_right</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
