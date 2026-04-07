"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Hls from "hls.js";
import { resolveUrl } from "@/lib/utils";
import { HLS_MAX_RETRIES } from "@/lib/constants";

interface VideoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  format: "hls" | "rtmp" | "mpegts";
  title?: string;
}

interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

interface SubtitleTrack {
  index: number;
  label: string;
  lang: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({
  isOpen,
  onClose,
  url,
  format,
  title = "Stream Preview",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Advanced controls state
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState(-1); // -1 = off
  const [speed, setSpeed] = useState(1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isPiP, setIsPiP] = useState(false);

  const { t } = useTranslation();
  const resolvedUrl = resolveUrl(url);

  const cleanup = useCallback(() => {
    retryCountRef.current = 0;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    setError(null);
    setLoading(true);
    setCopied(false);
    setQualities([]);
    setCurrentQuality(-1);
    setSubtitles([]);
    setCurrentSubtitle(-1);
    setSpeed(1);
    setShowQualityMenu(false);
    setShowSubtitleMenu(false);
    setShowSpeedMenu(false);
    setIsPiP(false);
  }, []);

  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const closeAllMenus = useCallback(() => {
    setShowQualityMenu(false);
    setShowSubtitleMenu(false);
    setShowSpeedMenu(false);
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP not supported or blocked
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;

    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "Escape":
          e.stopPropagation();
          e.preventDefault();
          handleClose();
          break;
        case " ":
        case "k":
          e.preventDefault();
          if (video) {
            if (video.paused) video.play().catch(() => {});
            else video.pause();
          }
          break;
        case "f":
          e.preventDefault();
          if (video) {
            if (document.fullscreenElement) document.exitFullscreen();
            else video.requestFullscreen?.();
          }
          break;
        case "m":
          e.preventDefault();
          if (video) video.muted = !video.muted;
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (video) video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (video) video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (video) video.volume = Math.min(1, video.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          if (video) video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "p":
          e.preventDefault();
          togglePiP();
          break;
      }
    };

    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [isOpen, handleClose, togglePiP]);

  // Load stream
  useEffect(() => {
    if (!isOpen || !url) return;

    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setLoading(true);

    if (format === "hls") {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        });
        hlsRef.current = hls;

        hls.loadSource(resolvedUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          setLoading(false);

          // Extract quality levels
          if (hls.levels.length > 1) {
            const levels: QualityLevel[] = hls.levels.map((level, i) => ({
              index: i,
              height: level.height,
              bitrate: level.bitrate,
              label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}k`,
            }));
            setQualities(levels);
          }

          // Extract subtitle tracks
          if (data.subtitleTracks && data.subtitleTracks.length > 0) {
            const subs: SubtitleTrack[] = data.subtitleTracks.map((track, i) => ({
              index: i,
              label: track.name || track.lang || `Track ${i + 1}`,
              lang: track.lang || "",
            }));
            setSubtitles(subs);
          }

          video.play().catch(() => setLoading(false));
        });

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
          if (data.subtitleTracks && data.subtitleTracks.length > 0) {
            const subs: SubtitleTrack[] = data.subtitleTracks.map((track, i) => ({
              index: i,
              label: track.name || track.lang || `Track ${i + 1}`,
              lang: track.lang || "",
            }));
            setSubtitles(subs);
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setLoading(false);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (retryCountRef.current < HLS_MAX_RETRIES) {
                  retryCountRef.current++;
                  console.warn(`HLS network error, retrying (${retryCountRef.current}/${HLS_MAX_RETRIES})...`);
                  hls.startLoad();
                } else {
                  setError(t("player.errorNetwork"));
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setError(t("player.errorFatal"));
                hls.destroy();
                hlsRef.current = null;
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        video.src = resolvedUrl;
        video.addEventListener("loadedmetadata", () => {
          setLoading(false);
          video.play().catch(() => setLoading(false));
        }, { once: true });
        video.addEventListener("error", () => {
          setLoading(false);
          setError(t("player.errorFatal"));
        }, { once: true });
      } else {
        setLoading(false);
        setError(t("player.unsupported"));
      }
    } else {
      setLoading(false);
      const formatName = format === "rtmp" ? "RTMP" : "MPEG-TS";
      setError(t("player.unsupportedFormat", { format: formatName }));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, url, format, resolvedUrl]);

  // PiP event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);
    video.addEventListener("enterpictureinpicture", onEnterPiP);
    video.addEventListener("leavepictureinpicture", onLeavePiP);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnterPiP);
      video.removeEventListener("leavepictureinpicture", onLeavePiP);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resolvedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = resolvedUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleQualityChange = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
    }
    setShowQualityMenu(false);
  };

  const handleSubtitleChange = (trackIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = trackIndex;
      setCurrentSubtitle(trackIndex);
    }
    setShowSubtitleMenu(false);
  };

  const handleSpeedChange = (newSpeed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed;
      setSpeed(newSpeed);
    }
    setShowSpeedMenu(false);
  };

  const pipSupported = typeof document !== "undefined" && document.pictureInPictureEnabled;
  const hasControls = qualities.length > 0 || subtitles.length > 0 || pipSupported;

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={closeAllMenus}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-4xl bg-dark-800 border border-dark-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-dark-700">
          <h2 className="text-sm font-semibold text-dark-100 truncate">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-xs text-dark-400 hover:text-dark-200 transition-colors px-2 py-1 rounded hover:bg-dark-700"
              aria-label={t("player.copyUrl")}
            >
              {copied ? t("common.copied") : t("player.copyUrl")}
            </button>
            <button
              onClick={handleClose}
              className="text-dark-400 hover:text-dark-100 transition-colors p-1 rounded-lg hover:bg-dark-700"
              aria-label={t("common.close")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {/* Loading */}
          {loading && !error && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-dark-600 border-t-primary-500" />
                <span className="text-sm text-dark-400" aria-live="polite">{t("player.loading")}</span>
              </div>
            </div>
          )}

          {/* Error / Fallback */}
          {error && (
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-6 text-center space-y-4" role="alert">
              <p className="text-sm text-dark-300">{error}</p>
              <div className="space-y-2">
                <code className="block text-xs text-dark-400 bg-dark-800 px-4 py-2 rounded-lg break-all">
                  {resolvedUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  {copied ? t("common.copied") : t("player.copyUrl")}
                </button>
              </div>
            </div>
          )}

          {/* Video element */}
          <video
            ref={videoRef}
            controls
            className={`w-full rounded-lg bg-black aspect-video ${error || loading ? "hidden" : ""}`}
            aria-label={title}
          />

          {/* Advanced controls toolbar */}
          {!error && !loading && hasControls && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Quality selector */}
              {qualities.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQualityMenu(!showQualityMenu);
                      setShowSubtitleMenu(false);
                      setShowSpeedMenu(false);
                    }}
                    className="flex items-center gap-1 text-xs text-dark-300 hover:text-dark-100 px-2 py-1.5 rounded hover:bg-dark-700 transition-colors"
                    aria-label={t("player.quality")}
                    aria-expanded={showQualityMenu}
                    aria-haspopup="menu"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    {currentQuality === -1 ? t("player.auto") : qualities.find(q => q.index === currentQuality)?.label || t("player.auto")}
                  </button>
                  {showQualityMenu && (
                    <div
                      className="absolute bottom-full mb-1 left-0 bg-dark-900 border border-dark-700 rounded-lg shadow-xl py-1 min-w-[120px] z-10"
                      role="menu"
                      aria-label={t("player.quality")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleQualityChange(-1)}
                        role="menuitem"
                        aria-checked={currentQuality === -1}
                        className={`w-full text-left text-xs px-3 py-1.5 hover:bg-dark-700 transition-colors ${currentQuality === -1 ? "text-primary-400" : "text-dark-300"}`}
                      >
                        {t("player.auto")}
                      </button>
                      {qualities.map((q) => (
                        <button
                          key={q.index}
                          onClick={() => handleQualityChange(q.index)}
                          role="menuitem"
                          aria-checked={currentQuality === q.index}
                          className={`w-full text-left text-xs px-3 py-1.5 hover:bg-dark-700 transition-colors ${currentQuality === q.index ? "text-primary-400" : "text-dark-300"}`}
                        >
                          {q.label} <span className="text-dark-500">{Math.round(q.bitrate / 1000)}k</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Subtitle selector */}
              {subtitles.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSubtitleMenu(!showSubtitleMenu);
                      setShowQualityMenu(false);
                      setShowSpeedMenu(false);
                    }}
                    className="flex items-center gap-1 text-xs text-dark-300 hover:text-dark-100 px-2 py-1.5 rounded hover:bg-dark-700 transition-colors"
                    aria-label={t("player.subtitles")}
                    aria-expanded={showSubtitleMenu}
                    aria-haspopup="menu"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/></svg>
                    CC
                  </button>
                  {showSubtitleMenu && (
                    <div
                      className="absolute bottom-full mb-1 left-0 bg-dark-900 border border-dark-700 rounded-lg shadow-xl py-1 min-w-[140px] z-10"
                      role="menu"
                      aria-label={t("player.subtitles")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleSubtitleChange(-1)}
                        role="menuitem"
                        aria-checked={currentSubtitle === -1}
                        className={`w-full text-left text-xs px-3 py-1.5 hover:bg-dark-700 transition-colors ${currentSubtitle === -1 ? "text-primary-400" : "text-dark-300"}`}
                      >
                        {t("player.off")}
                      </button>
                      {subtitles.map((s) => (
                        <button
                          key={s.index}
                          onClick={() => handleSubtitleChange(s.index)}
                          role="menuitem"
                          aria-checked={currentSubtitle === s.index}
                          className={`w-full text-left text-xs px-3 py-1.5 hover:bg-dark-700 transition-colors ${currentSubtitle === s.index ? "text-primary-400" : "text-dark-300"}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Speed selector */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeedMenu(!showSpeedMenu);
                    setShowQualityMenu(false);
                    setShowSubtitleMenu(false);
                  }}
                  className="flex items-center gap-1 text-xs text-dark-300 hover:text-dark-100 px-2 py-1.5 rounded hover:bg-dark-700 transition-colors"
                  aria-label={t("player.speed")}
                  aria-expanded={showSpeedMenu}
                  aria-haspopup="menu"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {speed}x
                </button>
                {showSpeedMenu && (
                  <div
                    className="absolute bottom-full mb-1 left-0 bg-dark-900 border border-dark-700 rounded-lg shadow-xl py-1 min-w-[80px] z-10"
                    role="menu"
                    aria-label={t("player.speed")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {SPEED_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        role="menuitem"
                        aria-checked={speed === s}
                        className={`w-full text-left text-xs px-3 py-1.5 hover:bg-dark-700 transition-colors ${speed === s ? "text-primary-400" : "text-dark-300"}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PiP button */}
              {pipSupported && (
                <button
                  onClick={togglePiP}
                  className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-dark-700 transition-colors ${isPiP ? "text-primary-400" : "text-dark-300 hover:text-dark-100"}`}
                  aria-label={t("player.pip")}
                  aria-pressed={isPiP}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="11" y="9" width="9" height="7" rx="1"/></svg>
                  PiP
                </button>
              )}

              {/* Keyboard shortcuts hint */}
              <span className="text-[10px] text-dark-500 ml-auto hidden sm:inline" aria-hidden="true">
                {t("player.shortcuts")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
