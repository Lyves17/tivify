"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, Tv, Film, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { userAPI } from "@/lib/api";
import type { WatchHistoryEntry } from "@/lib/types";
import { useToast } from "@/context/toast-context";
import Pagination from "@/components/ui/pagination";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { formatDurationTimer as formatDuration } from "@/lib/utils";

const PER_PAGE = 20;

function getTypeIcon(type: string) {
  switch (type) {
    case "channel":
      return <Tv size={14} />;
    case "vod":
      return <Film size={14} />;
    default:
      return <Clock size={14} />;
  }
}

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case "channel":
      return "bg-blue-600/20 text-blue-400";
    case "vod":
      return "bg-purple-600/20 text-purple-400";
    default:
      return "bg-dark-700 text-dark-300";
  }
}

function getContentHref(entry: WatchHistoryEntry): string {
  switch (entry.content_type) {
    case "channel":
      return `/channels/${entry.content_id}`;
    case "vod":
      return `/vod/${entry.content_id}`;
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

export default function HistoryPage() {
  const toast = useToast();
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  const getTypeLabel = useCallback((type: string): string => {
    switch (type) {
      case "channel": return t("contentType.channel");
      case "vod": return t("contentType.movie");
      default: return type;
    }
  }, [t]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.getHistory(page, PER_PAGE);
      setHistory(data.data || []);
      setTotalPages(data.meta.pages);
    } catch {
      toast.error(t("history.errorLoadingHistory"));
    } finally {
      setLoading(false);
    }
  }, [page, toast, t]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    document.title = `${t("history.title")} | TIVIFY`;
  }, [t]);

  const handleDelete = async (id: number) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await userAPI.deleteHistory(id);
      toast.success(t("history.entryDeleted"));
      setHistory((prev) => prev.filter((entry) => entry.id !== id));
    } catch {
      toast.error(t("history.errorDeletingEntry"));
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t("history.title")}</h1>

      {loading ? (
        <LoadingSpinner text={t("history.loadingHistory")} />
      ) : history.length === 0 ? (
        <div className="text-center py-12">
          <Clock size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-dark-400">{t("history.noHistory")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {history.map((entry) => {
              const progressPercent =
                entry.duration > 0 ? Math.min((entry.progress / entry.duration) * 100, 100) : 0;

              return (
                <div
                  key={entry.id}
                  className="bg-dark-800 border border-dark-700 rounded-xl p-4 hover:border-dark-600 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Link
                      href={getContentHref(entry)}
                      className="flex items-center gap-4 flex-1 min-w-0 group"
                    >
                      {entry.content_poster ? (
                        <Image
                          src={entry.content_poster}
                          alt={entry.content_name}
                          width={40}
                          height={56}
                          className="rounded object-cover shrink-0 bg-dark-700"
                        />
                      ) : (
                        <div className="w-10 h-14 rounded bg-dark-700 flex items-center justify-center shrink-0">
                          {getTypeIcon(entry.content_type)}
                        </div>
                      )}

                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium shrink-0 ${getTypeBadgeColor(
                          entry.content_type
                        )}`}
                      >
                        {getTypeIcon(entry.content_type)}
                        {getTypeLabel(entry.content_type)}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-dark-100 text-sm font-medium truncate group-hover:text-primary-400 transition-colors">
                          {entry.content_name || `ID: ${entry.content_id}`}
                        </p>

                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-dark-400 shrink-0">
                            {formatDuration(entry.progress)} / {formatDuration(entry.duration)}
                          </span>
                        </div>

                        <p className="text-dark-400 text-xs mt-1.5">
                          {t("history.watched")} {formatDate(entry.watched_at, i18n.language)}
                        </p>
                      </div>
                    </Link>

                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingIds.has(entry.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-600/10 transition-colors disabled:opacity-50 shrink-0"
                    >
                      <Trash2 size={14} />
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
