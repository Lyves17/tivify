"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Hls from "hls.js";
import { ChevronLeft, Tv } from "lucide-react";
import { userAPI } from "@/lib/api";
import type { Channel, Stream } from "@/lib/types";
import { useToast } from "@/context/toast-context";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { resolveUrl } from "@/lib/utils";

export default function ChannelDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch channel data
  const fetchChannel = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.getChannel(id);
      setChannel(data.data);
    } catch {
      toastRef.current.error("Error al cargar canal");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchChannel();
  }, [id, fetchChannel]);

  // Determine the best stream URL
  const bestStream = useMemo((): Stream | null => {
    if (!channel?.streams || channel.streams.length === 0) return null;

    const activeStreams = channel.streams.filter((s) => s.is_active);
    if (activeStreams.length === 0) return null;

    // Prefer live emission stream (highest priority, URL contains /media/live/)
    const liveStream = activeStreams.find((s) => s.url.includes("/media/live/"));
    if (liveStream) return liveStream;

    // Otherwise, highest priority active HLS stream
    const hlsStreams = activeStreams
      .filter((s) => s.stream_format === "hls")
      .sort((a, b) => b.priority - a.priority);
    if (hlsStreams.length > 0) return hlsStreams[0];

    // Fallback: any active stream
    return activeStreams.sort((a, b) => b.priority - a.priority)[0];
  }, [channel]);

  const isLive = bestStream?.url.includes("/media/live/") || false;

  // Initialize HLS player
  useEffect(() => {
    if (!bestStream || !videoRef.current) return;

    const video = videoRef.current;
    const resolvedUrl = resolveUrl(bestStream.url);
    setPlayerError(null);
    setPlayerReady(false);

    // Cleanup previous retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (bestStream.stream_format !== "hls") {
      setPlayerError(
        `Los streams ${bestStream.stream_format.toUpperCase()} no se pueden reproducir en el navegador. Usa VLC u otro reproductor compatible.`
      );
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        // Live sync: stay close to the live edge
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        // Buffer settings for smooth playback
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hlsRef.current = hls;

      hls.loadSource(resolvedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setPlayerReady(true);
        setPlayerError(null);
        video.play().catch(() => {
          // Autoplay blocked, user needs to click play
          setPlayerReady(true);
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.MEDIA_ERROR:
              // Try to recover from media errors
              hls.recoverMediaError();
              break;
            case Hls.ErrorTypes.NETWORK_ERROR:
              setPlayerError("Error de red. Reintentando en 5 segundos...");
              // Auto-retry for network errors (common during live emission startup)
              retryTimeoutRef.current = setTimeout(() => {
                setPlayerError(null);
                hls.loadSource(resolvedUrl);
              }, 5000);
              break;
            default:
              setPlayerError("Error al reproducir el stream.");
              hls.destroy();
              hlsRef.current = null;
              // Auto-retry after 5s
              retryTimeoutRef.current = setTimeout(() => {
                setPlayerError(null);
                // Re-trigger the effect by updating channel reference
                setChannel((prev) => (prev ? { ...prev } : prev));
              }, 5000);
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
        () => {
          setPlayerError("Error al reproducir el stream.");
        },
        { once: true }
      );
    } else {
      setPlayerError("Tu navegador no soporta reproduccion HLS.");
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
  }, [bestStream]);

  if (loading) {
    return <LoadingSpinner text="Cargando canal..." />;
  }

  if (!channel) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-400">Canal no encontrado</p>
        <Link
          href="/channels"
          className="text-primary-400 hover:text-primary-300 mt-4 inline-block"
        >
          Volver a canales
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <Link
        href="/channels"
        className="inline-flex items-center gap-1 text-dark-400 hover:text-dark-100 transition-colors mb-4"
      >
        <ChevronLeft size={18} />
        Volver a canales
      </Link>

      {/* Channel header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-lg bg-dark-700 flex items-center justify-center overflow-hidden shrink-0 relative">
          {channel.logo_url ? (
            <Image
              src={channel.logo_url}
              alt={channel.name}
              fill
              className="object-contain"
              sizes="48px"
            />
          ) : (
            <Tv size={24} className="text-dark-500" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-dark-100">{channel.name}</h1>
            {isLive && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/20">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-red-400">EN VIVO</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {channel.category && (
              <p className="text-sm text-dark-400">{channel.category.name}</p>
            )}
            {channel.channel_number !== null && (
              <span className="text-xs bg-dark-700 text-dark-300 px-2 py-0.5 rounded-full">
                Canal {channel.channel_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Video Player (inline) */}
      {bestStream ? (
        <div className="rounded-xl overflow-hidden bg-black relative">
          {/* Error overlay */}
          {playerError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center p-6">
                <p className="text-sm text-dark-300 mb-2">{playerError}</p>
                {bestStream.stream_format === "hls" && (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500 mx-auto" />
                )}
              </div>
            </div>
          )}

          {/* Loading spinner before player is ready */}
          {!playerReady && !playerError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500" />
                <span className="text-sm text-dark-400">Cargando stream...</span>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            controls
            autoPlay
            className="w-full aspect-video"
          />
        </div>
      ) : (
        <div className="rounded-xl bg-dark-800 border border-dark-700 p-12 text-center">
          <Tv size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-dark-400">Este canal no tiene streams disponibles</p>
          <p className="text-dark-500 text-sm mt-2">
            El administrador debe configurar streams para este canal.
          </p>
        </div>
      )}

      {/* Stream info (optional, shown below player) */}
      {bestStream && channel.streams && channel.streams.filter((s) => s.is_active).length > 1 && (
        <div className="mt-4 rounded-lg bg-dark-800 border border-dark-700 p-4">
          <p className="text-xs text-dark-400 mb-2">Streams disponibles</p>
          <div className="space-y-1.5">
            {channel.streams
              .filter((s) => s.is_active)
              .sort((a, b) => b.priority - a.priority)
              .map((stream) => (
                <div
                  key={stream.id}
                  className={`flex items-center gap-2 text-xs rounded-md px-3 py-1.5 ${
                    stream.id === bestStream.id
                      ? "bg-primary-600/20 text-primary-400"
                      : "text-dark-400"
                  }`}
                >
                  <span className="font-medium">{stream.stream_format.toUpperCase()}</span>
                  <span className="text-dark-500">P{stream.priority}</span>
                  {stream.url.includes("/media/live/") && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-red-400">Live</span>
                    </span>
                  )}
                  {stream.id === bestStream.id && (
                    <span className="text-primary-400">(reproduciendo)</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
