"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Tv, Film, BookOpen, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { userAPI } from "@/lib/api";
import type { Favorite } from "@/lib/types";
import { useToast } from "@/context/toast-context";
import Pagination from "@/components/ui/pagination";
import LoadingSpinner from "@/components/ui/loading-spinner";

const PER_PAGE = 20;

function getTypeIcon(type: string) {
  switch (type) {
    case "channel":
      return <Tv size={14} />;
    case "vod":
      return <Film size={14} />;
    case "series":
      return <BookOpen size={14} />;
    default:
      return <Heart size={14} />;
  }
}

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case "channel":
      return "bg-blue-600/20 text-blue-400";
    case "vod":
      return "bg-purple-600/20 text-purple-400";
    case "series":
      return "bg-green-600/20 text-green-400";
    default:
      return "bg-dark-700 text-dark-300";
  }
}

function getContentHref(fav: Favorite): string {
  switch (fav.favoritable_type) {
    case "channel":
      return `/channels/${fav.favoritable_id}`;
    case "vod":
      return `/vod/${fav.favoritable_id}`;
    case "series":
      return `/series/${fav.favoritable_id}`;
    default:
      return "#";
  }
}

function formatDate(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FavoritesPage() {
  const toast = useToast();
  const { t, i18n } = useTranslation();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());

  const getTypeLabel = useCallback((type: string): string => {
    switch (type) {
      case "channel": return t("contentType.channel");
      case "vod": return t("contentType.movie");
      case "series": return t("contentType.series");
      default: return type;
    }
  }, [t]);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.getFavorites(page, PER_PAGE);
      setFavorites(data.data || []);
      setTotalPages(data.meta.pages);
    } catch {
      toast.error(t("favorites.errorLoadingFavorites"));
    } finally {
      setLoading(false);
    }
  }, [page, toast, t]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    document.title = `${t("favorites.title")} | TIVIFY`;
  }, [t]);

  const handleRemove = async (fav: Favorite) => {
    setRemovingIds((prev) => new Set(prev).add(fav.id));
    try {
      await userAPI.toggleFavorite(fav.favoritable_type, fav.favoritable_id);
      toast.success(t("favorites.removedFromFavorites"));
      setFavorites((prev) => prev.filter((f) => f.id !== fav.id));
    } catch {
      toast.error(t("favorites.errorRemovingFavorite"));
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(fav.id);
        return next;
      });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t("favorites.title")}</h1>

      {loading ? (
        <LoadingSpinner text={t("favorites.loadingFavorites")} />
      ) : favorites.length === 0 ? (
        <div className="text-center py-12">
          <Heart size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-dark-400">{t("favorites.noFavorites")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {favorites.map((fav) => (
              <div
                key={fav.id}
                className="bg-dark-800 border border-dark-700 rounded-xl p-4 hover:border-dark-600 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <Link
                    href={getContentHref(fav)}
                    className="flex items-center gap-4 min-w-0 flex-1 group"
                  >
                    {fav.content_poster ? (
                      <Image
                        src={fav.content_poster}
                        alt={fav.content_name}
                        width={40}
                        height={56}
                        className="rounded object-cover shrink-0 bg-dark-700"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-dark-700 flex items-center justify-center shrink-0">
                        {getTypeIcon(fav.favoritable_type)}
                      </div>
                    )}

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium shrink-0 ${getTypeBadgeColor(
                        fav.favoritable_type
                      )}`}
                    >
                      {getTypeIcon(fav.favoritable_type)}
                      {getTypeLabel(fav.favoritable_type)}
                    </span>

                    <div className="min-w-0">
                      <p className="text-dark-100 text-sm font-medium truncate group-hover:text-primary-400 transition-colors">
                        {fav.content_name || `ID: ${fav.favoritable_id}`}
                      </p>
                      <p className="text-dark-400 text-xs mt-0.5">
                        {t("favorites.added")} {formatDate(fav.created_at, i18n.language)}
                      </p>
                    </div>
                  </Link>

                  <button
                    onClick={() => handleRemove(fav)}
                    disabled={removingIds.has(fav.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-600/10 transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Trash2 size={14} />
                    {t("common.delete")}
                  </button>
                </div>
              </div>
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
