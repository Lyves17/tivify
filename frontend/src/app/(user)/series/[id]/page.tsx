"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Film, Star, Clock, Play } from "lucide-react";
import { userAPI } from "@/lib/api";
import type { SeriesWithCount, VOD } from "@/lib/types";
import { useToast } from "@/context/toast-context";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { formatDurationHuman as formatDuration } from "@/lib/utils";


export default function SeriesDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const toast = useToast();

  const [series, setSeries] = useState<SeriesWithCount | null>(null);
  const [episodes, setEpisodes] = useState<VOD[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [seriesRes, episodesRes] = await Promise.all([
        userAPI.getSeriesById(id),
        userAPI.getSeriesEpisodes(id),
      ]);
      setSeries(seriesRes.data.data);
      setEpisodes(episodesRes.data.data || []);
    } catch {
      toast.error("Error al cargar la serie");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) fetchData();
  }, [id, fetchData]);

  // Group episodes by season
  const seasons = useMemo(() => {
    const map = new Map<number, VOD[]>();
    episodes.forEach((ep) => {
      const season = ep.season_number || 1;
      if (!map.has(season)) map.set(season, []);
      map.get(season)!.push(ep);
    });
    // Sort episodes within each season by episode_number
    map.forEach((eps) => eps.sort((a, b) => a.episode_number - b.episode_number));
    return map;
  }, [episodes]);

  const seasonNumbers = useMemo(() => {
    return Array.from(seasons.keys()).sort((a, b) => a - b);
  }, [seasons]);

  // Set initial selected season
  useEffect(() => {
    if (seasonNumbers.length > 0 && !seasonNumbers.includes(selectedSeason)) {
      setSelectedSeason(seasonNumbers[0]);
    }
  }, [seasonNumbers, selectedSeason]);

  const currentEpisodes = seasons.get(selectedSeason) || [];

  if (loading) {
    return <LoadingSpinner text="Cargando serie..." />;
  }

  if (!series) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-400">Serie no encontrada</p>
        <Link href="/series" className="text-primary-400 hover:text-primary-300 mt-4 inline-block">
          Volver a series
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <Link
        href="/series"
        className="inline-flex items-center gap-1 text-dark-400 hover:text-dark-100 transition-colors mb-6"
      >
        <ChevronLeft size={18} />
        Volver a series
      </Link>

      {/* Series header */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Poster */}
        <div className="w-full md:w-56 shrink-0">
          <div className="aspect-[2/3] rounded-xl overflow-hidden">
            {series.poster_url ? (
              <Image
                src={series.poster_url}
                alt={series.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 224px"
              />
            ) : (
              <div className="w-full h-full bg-dark-700 flex items-center justify-center">
                <Film size={48} className="text-dark-500" />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-dark-100">{series.title}</h1>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-dark-400">
            {series.year > 0 && <span>{series.year}</span>}
            {series.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                {series.rating.toFixed(1)}
              </span>
            )}
            <span>
              {series.total_seasons} {series.total_seasons === 1 ? "temporada" : "temporadas"}
            </span>
            <span>{series.episodes_count} episodios</span>
          </div>

          {series.category && (
            <span className="inline-block mt-3 text-xs bg-dark-700 text-dark-300 px-3 py-1 rounded-full">
              {series.category.name}
            </span>
          )}

          {series.description && (
            <p className="text-dark-300 mt-4 leading-relaxed">{series.description}</p>
          )}
        </div>
      </div>

      {/* Season tabs */}
      {seasonNumbers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {seasonNumbers.map((num) => (
            <button
              key={num}
              onClick={() => setSelectedSeason(num)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedSeason === num
                  ? "bg-primary-600 text-white"
                  : "bg-dark-800 text-dark-300 border border-dark-700 hover:border-primary-500/50"
              }`}
            >
              T{num}
            </button>
          ))}
        </div>
      )}

      {/* Episodes list */}
      {currentEpisodes.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-dark-400">No hay episodios para esta temporada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentEpisodes.map((ep) => (
            <Link
              key={ep.id}
              href={`/vod/${ep.id}`}
              className="bg-dark-800 border border-dark-700 rounded-xl p-4 hover:border-primary-500/50 transition-colors cursor-pointer block"
            >
              <div className="flex items-start gap-4">
                {/* Episode number */}
                <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center shrink-0">
                  <Play size={16} className="text-dark-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary-400 font-medium">
                      E{ep.episode_number}
                    </span>
                    <h3 className="text-dark-100 font-medium truncate">{ep.title}</h3>
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-dark-400">
                    {ep.duration > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDuration(ep.duration)}
                      </span>
                    )}
                    {ep.rating > 0 && (
                      <span className="flex items-center gap-1">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" />
                        {ep.rating.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {ep.description && (
                    <p className="text-dark-400 text-sm mt-2 line-clamp-2">{ep.description}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
