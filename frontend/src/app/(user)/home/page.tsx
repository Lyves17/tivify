"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, Film, Tv, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { userAPI } from "@/lib/api";
import type { WatchHistoryEntry } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function HomePage() {
  const { t } = useTranslation();
  const [continueWatching, setContinueWatching] = useState<WatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data } = await userAPI.getContinueWatching(10);
      setContinueWatching(data.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    document.title = `${t("home.title")} | TIVIFY`;
  }, [t]);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t("home.title")}</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-dark-200 mb-4">
          {t("home.continueWatching")}
        </h2>
        {continueWatching.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {continueWatching.map((item) => {
              const progressPercent =
                item.duration > 0
                  ? Math.min((item.progress / item.duration) * 100, 100)
                  : 0;
              return (
                <Link
                  key={item.id}
                  href={`/vod/${item.content_id}`}
                  className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden hover:border-primary-500/50 transition-colors group block"
                  aria-label={`Continue watching: ${item.content_name}`}
                >
                  <div className="aspect-[2/3] relative overflow-hidden">
                    {item.content_poster ? (
                      <Image
                        src={item.content_poster}
                        alt={`Poster for ${item.content_name}`}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full bg-dark-700 flex items-center justify-center" role="img" aria-label="No poster available">
                        <Film size={32} className="text-dark-500" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <Play size={40} className="text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-dark-900/60">
                      <div
                        className="h-full bg-primary-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-dark-100 text-xs font-medium truncate">
                      {item.content_name}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-dark-800/50 rounded-xl border border-dark-700">
            <p className="text-dark-400">{t("home.nothingYet")}</p>
            <p className="text-dark-500 text-sm mt-1">{t("home.exploreHint")}</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-dark-200 mb-4">{t("home.explore")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/channels"
            className="card hover:border-primary-500/50 transition-colors flex items-center gap-4 p-6"
          >
            <Tv size={32} className="text-blue-400" />
            <div>
              <p className="text-dark-100 font-semibold">{t("nav.channels")}</p>
              <p className="text-dark-400 text-sm">{t("home.liveTV")}</p>
            </div>
          </Link>
          <Link
            href="/vod"
            className="card hover:border-primary-500/50 transition-colors flex items-center gap-4 p-6"
          >
            <Film size={32} className="text-purple-400" />
            <div>
              <p className="text-dark-100 font-semibold">{t("nav.vod")}</p>
              <p className="text-dark-400 text-sm">{t("home.vodCatalog")}</p>
            </div>
          </Link>
          <Link
            href="/series"
            className="card hover:border-primary-500/50 transition-colors flex items-center gap-4 p-6"
          >
            <BookOpen size={32} className="text-green-400" />
            <div>
              <p className="text-dark-100 font-semibold">{t("nav.series")}</p>
              <p className="text-dark-400 text-sm">{t("home.episodesLabel")}</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
