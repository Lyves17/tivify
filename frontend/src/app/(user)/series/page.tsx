"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { userAPI } from "@/lib/api";
import type { SeriesWithCount, Category } from "@/lib/types";
import { useToast } from "@/context/toast-context";
import Pagination from "@/components/ui/pagination";
import SearchInput from "@/components/ui/search-input";
import LoadingSpinner from "@/components/ui/loading-spinner";

const PER_PAGE = 20;

export default function SeriesPage() {
  const toast = useToast();
  const { t } = useTranslation();
  const [series, setSeries] = useState<SeriesWithCount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await userAPI.getCategories("series");
      if (data.data) {
        setCategories(data.data);
      }
    } catch {
      toast.error(t("common.errorLoadingCategories"));
    }
  }, [toast, t]);

  const fetchSeries = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.getSeries(page, PER_PAGE, search || undefined, selectedCategory);
      setSeries(data.data || []);
      setTotalPages(data.meta.pages);
    } catch {
      toast.error(t("series.errorLoadingSeries"));
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, toast, t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  useEffect(() => {
    document.title = `${t("series.title")} | TIVIFY`;
  }, [t]);

  const handleCategoryChange = (categoryId: number | undefined) => {
    setSelectedCategory(categoryId);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t("series.title")}</h1>

      <div className="mb-4 max-w-md">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder={t("series.searchPlaceholder")}
        />
      </div>

      {categories.length > 0 && (
        <div className="mb-6">
          <select
            value={selectedCategory ?? ""}
            onChange={(e) => handleCategoryChange(e.target.value ? Number(e.target.value) : undefined)}
            className="input-field w-full sm:w-72 text-sm cursor-pointer"
          >
            <option value="">{t("common.allCategories")}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <LoadingSpinner text={t("series.loadingSeries")} />
      ) : series.length === 0 ? (
        <div className="text-center py-12">
          <Film size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-dark-400">{t("series.noSeriesFound")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {series.map((s) => (
              <Link
                key={s.id}
                href={`/series/${s.id}`}
                className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden hover:border-primary-500/50 transition-colors group"
              >
                <div className="aspect-[2/3] relative overflow-hidden">
                  {s.poster_url ? (
                    <Image
                      src={s.poster_url}
                      alt={s.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-dark-700 flex items-center justify-center">
                      <Film size={48} className="text-dark-500" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-dark-900/80 text-dark-100 text-xs px-2 py-1 rounded-lg backdrop-blur-sm">
                    {s.episodes_count} {s.episodes_count === 1 ? t("series.episodes_one") : t("series.episodes_other")}
                  </div>
                </div>

                <div className="p-3">
                  <h3 className="text-dark-100 font-semibold text-sm truncate">{s.title}</h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-dark-400">
                    {s.year > 0 && <span>{s.year}</span>}
                    {s.rating > 0 && (
                      <span className="flex items-center gap-1">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" />
                        {s.rating.toFixed(1)}
                      </span>
                    )}
                    {s.total_seasons > 0 && (
                      <span>
                        {s.total_seasons} {s.total_seasons === 1 ? t("series.season_one") : t("series.season_other")}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
