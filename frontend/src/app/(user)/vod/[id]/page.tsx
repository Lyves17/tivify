"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Hls from "hls.js";
import { ChevronLeft, Film, Star, Clock } from "lucide-react";
import { userAPI } from "@/lib/api";
import type { VOD, WatchHistoryEntry } from "@/lib/types";
import { useToast } from "@/context/toast-context";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { resolveUrl, formatDurationHuman as formatDuration, formatDurationTimer } from "@/lib/utils";

export default function VODDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [vod, setVod] = useState<VOD | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedProgressRef = useRef<number>(0);

  const stopStatusPoll = () => {
    if (statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
  };

  const fetchVOD = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.getVOD(id);
      const v = data.data;
      setVod(v);
    } catch {
      toastRef.current.error("Error al cargar la pelicula");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchVOD();
  }, [id, fetchVOD]);

  // Fetch saved progress for resume playback
  useEffect(() => {
    if (!vod) return;
    (async () => {
      try {
        const { data } = await userAPI.getContinueWatching(50);
        const items: WatchHistoryEntry[] = data.data || [];
        const entry = items.find(
          (h) => h.content_type === "vod" && h.content_id === vod.id
        );
        if (entry && entry.progress > 0) {
          savedProgressRef.current = entry.progress;
        }
      } catch {
        // ignore — playback starts from beginning
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vod?.id]);

  // Auto-poll when VOD is processing/pending — refresh silently until completed or failed
  useEffect(() => {
    if (!vod) return;
    const isTranscoding = vod.transcode_status === "processing" || vod.transcode_status === "pending";
    if (!isTranscoding) {
      stopStatusPoll();
      return;
    }

    stopStatusPoll();

    statusPollRef.current = setInterval(async () => {
      try {
        const { data } = await userAPI.getVOD(id);
        const updated = data.data;
        setVod(updated);
        if (updated.transcode_status === "completed" || updated.transcode_status === "failed") {
          stopStatusPoll();
        }
      } catch {
        // ignore transient errors during polling
      }
    }, 5000);

    return () => stopStatusPoll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vod?.transcode_status, id]);

  // Initialize player (HLS or direct file)
  useEffect(() => {
    if (!vod?.hls_path || !videoRef.current) return;
    if (vod.transcode_status !== "completed") return;

    const video = videoRef.current;
    const resolvedUrl = resolveUrl(vod.hls_path);
    const isHLS = vod.hls_path.endsWith(".m3u8");
    setPlayerError(null);
    setPlayerReady(false);

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (!isHLS) {
      // Direct file playback (mp4, webm, etc.)
      video.src = resolvedUrl;
      video.addEventListener(
        "loadedmetadata",
        () => {
          setPlayerReady(true);
          video.play().catch(() => setPlayerReady(true));
        },
        { once: true }
      );
      video.addEventListener(
        "error",
        () => setPlayerError("Error al reproducir el video."),
        { once: true }
      );
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
      });
      hlsRef.current = hls;

      hls.loadSource(resolvedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setPlayerReady(true);
        setPlayerError(null);
        video.play().catch(() => setPlayerReady(true));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            case Hls.ErrorTypes.NETWORK_ERROR:
              setPlayerError("Error de red. Reintentando en 5 segundos...");
              retryTimeoutRef.current = setTimeout(() => {
                setPlayerError(null);
                hls.loadSource(resolvedUrl);
              }, 5000);
              break;
            default:
              setPlayerError("Error al reproducir el video.");
              hls.destroy();
              hlsRef.current = null;
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = resolvedUrl;
      video.addEventListener(
        "loadedmetadata",
        () => {
          setPlayerReady(true);
          video.play().catch(() => setPlayerReady(true));
        },
        { once: true }
      );
      video.addEventListener(
        "error",
        () => setPlayerError("Error al reproducir el video."),
        { once: true }
      );
    } else {
      setPlayerError("Tu navegador no soporta este formato de video.");
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vod?.hls_path, vod?.transcode_status]);

  // Resume playback from saved position when player is ready
  useEffect(() => {
    if (!playerReady || !videoRef.current) return;
    const saved = savedProgressRef.current;
    if (saved > 0) {
      videoRef.current.currentTime = saved;
      savedProgressRef.current = 0;
      toastRef.current.info(`Reanudando desde ${formatDurationTimer(saved)}`);
    }
  }, [playerReady]);

  // Record watch history every 30s while playing + save on exit
  useEffect(() => {
    if (!vod || !playerReady) return;
    const video = videoRef.current;
    if (!video) return;

    const saveProgress = () => {
      if (video.currentTime > 0) {
        // Use fetch with keepalive for reliable save on page unload
        const token = localStorage.getItem("access_token");
        fetch("/api/v1/history", {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            content_type: "vod",
            content_id: vod.id,
            progress: Math.floor(video.currentTime),
            duration: Math.floor(video.duration) || vod.duration,
          }),
        }).catch(() => {});
      }
    };

    const handleBeforeUnload = () => saveProgress();

    window.addEventListener("beforeunload", handleBeforeUnload);

    progressIntervalRef.current = setInterval(async () => {
      if (video.currentTime > 0 && !video.paused) {
        try {
          await userAPI.recordHistory({
            content_type: "vod",
            content_id: vod.id,
            progress: Math.floor(video.currentTime),
            duration: Math.floor(video.duration) || vod.duration,
          });
        } catch {
          // ignore history errors silently
        }
      }
    }, 30000);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      // Save progress on component unmount (navigation away)
      if (video.currentTime > 0) {
        userAPI.recordHistory({
          content_type: "vod",
          content_id: vod.id,
          progress: Math.floor(video.currentTime),
          duration: Math.floor(video.duration) || vod.duration,
        }).catch(() => {});
      }
    };
  }, [vod, playerReady]);

  const backLink = vod?.series_id ? `/series/${vod.series_id}` : "/vod";
  const backLabel = vod?.series_id ? "Volver a la serie" : "Volver a peliculas";

  if (loading) {
    return <LoadingSpinner text="Cargando pelicula..." />;
  }

  if (!vod) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-400">Pelicula no encontrada</p>
        <Link href="/vod" className="text-primary-400 hover:text-primary-300 mt-4 inline-block">
          Volver a peliculas
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <Link
        href={backLink}
        className="inline-flex items-center gap-1 text-dark-400 hover:text-dark-100 transition-colors mb-4"
      >
        <ChevronLeft size={18} />
        {backLabel}
      </Link>

      {/* Backdrop header — hide when video player is active */}
      {vod.backdrop_url && !(vod.hls_path && vod.transcode_status === "completed") && (
        <div className="relative rounded-xl overflow-hidden mb-6 max-h-64 md:max-h-80 aspect-video">
          <Image
            src={vod.backdrop_url}
            alt={vod.title}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/30 to-transparent" />
        </div>
      )}

      {/* VOD info */}
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        {/* Poster (only when no backdrop) */}
        {vod.poster_url && !vod.backdrop_url && (
          <div className="w-40 shrink-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden relative">
              <Image
                src={vod.poster_url}
                alt={vod.title}
                fill
                className="object-cover"
                sizes="160px"
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {vod.series_id && vod.season_number > 0 && (
            <p className="text-sm text-primary-400 font-medium mb-1">
              Temporada {vod.season_number} · Episodio {vod.episode_number}
            </p>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-dark-100">{vod.title}</h1>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-dark-400">
            {vod.year > 0 && <span>{vod.year}</span>}
            {vod.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                {vod.rating.toFixed(1)}
              </span>
            )}
            {vod.duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {formatDuration(vod.duration)}
              </span>
            )}
            {vod.resolution && (
              <span className="bg-dark-700 px-2 py-0.5 rounded text-xs">{vod.resolution}</span>
            )}
          </div>

          {vod.category && (
            <span className="inline-block mt-2 text-xs bg-dark-700 text-dark-300 px-3 py-1 rounded-full">
              {vod.category.name}
            </span>
          )}

          {vod.description && (
            <p className="text-dark-300 mt-4 leading-relaxed">{vod.description}</p>
          )}
        </div>
      </div>

      {/* Video player */}
      {vod.hls_path && vod.transcode_status === "completed" ? (
        <div className="rounded-xl overflow-hidden bg-black relative">
          {playerError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center p-6">
                <p className="text-sm text-dark-300 mb-3">{playerError}</p>
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500 mx-auto" />
              </div>
            </div>
          )}

          {!playerReady && !playerError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500" />
                <span className="text-sm text-dark-400">Cargando video...</span>
              </div>
            </div>
          )}

          <video ref={videoRef} controls autoPlay className="w-full aspect-video" />
        </div>
      ) : vod.transcode_status === "processing" || (vod.transcode_status === "pending" && !!vod.hls_path) ? (
        <div className="rounded-xl bg-dark-800 border border-dark-700 p-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500 mx-auto mb-4" />
          <p className="text-dark-300 font-medium">Procesando video...</p>
          {vod.transcode_progress > 0 && (
            <div className="mt-3 max-w-xs mx-auto">
              <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${vod.transcode_progress}%` }}
                />
              </div>
              <p className="text-dark-400 text-sm mt-1">{vod.transcode_progress}%</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-dark-800 border border-dark-700 p-10 text-center">
          <Film size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-dark-400 font-medium">Este video no está disponible para reproducción</p>
          <p className="text-dark-500 text-sm mt-2">
            El contenido aún no está listo. Intenta de nuevo más tarde.
          </p>
        </div>
      )}
    </div>
  );
}
