"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  if (current <= 3) {
    pages.push(1, 2, 3, 4, "...", total);
  } else if (current >= total - 2) {
    pages.push(1, "...", total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }

  return pages;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  const handlePageChange = (newPage: number) => {
    onPageChange(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <nav className="flex items-center justify-center gap-1 flex-wrap" aria-label={t("common.pagination")}>
      <button
        onClick={() => handlePageChange(page - 1)}
        disabled={page <= 1}
        className="btn-secondary flex items-center gap-1 px-3 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={t("common.previousPage")}
      >
        <ChevronLeft size={16} aria-hidden="true" />
        <span className="hidden sm:inline">{t("common.previous")}</span>
      </button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            className="px-2 py-2 text-sm text-dark-400"
            aria-hidden="true"
          >
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => handlePageChange(p)}
            className={`min-w-[36px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              p === page
                ? "bg-primary-600 text-white"
                : "btn-secondary"
            }`}
            aria-label={`${t("common.page")} ${p}`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => handlePageChange(page + 1)}
        disabled={page >= totalPages}
        className="btn-secondary flex items-center gap-1 px-3 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={t("common.nextPage")}
      >
        <span className="hidden sm:inline">{t("common.next")}</span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
