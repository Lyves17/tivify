"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, Tv, Film, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { userAPI } from "@/lib/api";
import type { ChannelList, VOD, SeriesWithCount } from "@/lib/types";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

interface SearchResults {
  channels: ChannelList[];
  vods: VOD[];
  series: SeriesWithCount[];
}

export default function GlobalSearch() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    try {
      const { data } = await userAPI.search(q.trim());
      if (!signal.aborted) {
        setResults(data.data);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.warn('Search error:', err);
      }
      if (!signal.aborted) {
        setResults(null);
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(value), SEARCH_DEBOUNCE_MS);
  };

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClose = () => {
    setOpen(false);
    setQuery("");
    setResults(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const hasResults = results && (results.channels.length > 0 || results.vods.length > 0 || results.series.length > 0);
  const noResults = results && !hasResults && query.trim().length > 0;

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="text-dark-400 hover:text-dark-100 transition-colors p-1.5"
        title={t("common.search")}
      >
        <Search size={20} />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5">
        <Search size={16} className="text-dark-400 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="bg-transparent text-dark-100 text-sm outline-none w-48 sm:w-64 placeholder:text-dark-500"
        />
        <button onClick={handleClose} className="text-dark-400 hover:text-dark-100 shrink-0" aria-label={t("common.close")}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {(hasResults || noResults || loading) && (
        <div className="absolute top-full mt-2 left-0 right-0 sm:w-96 sm:right-auto bg-dark-800 border border-dark-700 rounded-xl shadow-2xl z-50 max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-dark-400 text-sm">{t("search.searching")}</div>
          )}

          {noResults && !loading && (
            <div className="px-4 py-3 text-dark-400 text-sm">{t("search.noResultsFor")} &ldquo;{query}&rdquo;</div>
          )}

          {hasResults && !loading && (
            <div>
              {results.channels.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-dark-400 uppercase flex items-center gap-2">
                    <Tv size={14} /> {t("nav.channels")}
                  </div>
                  {results.channels.map((ch) => (
                    <Link
                      key={`ch-${ch.id}`}
                      href={`/channels/${ch.id}`}
                      onClick={handleClose}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-dark-700/50 transition-colors"
                    >
                      <div className="relative w-8 h-8 rounded bg-dark-700 flex items-center justify-center overflow-hidden shrink-0">
                        {ch.logo_url ? (
                          <Image src={ch.logo_url} alt={ch.name} fill sizes="32px" className="object-contain" />
                        ) : (
                          <Tv size={14} className="text-dark-500" />
                        )}
                      </div>
                      <span className="text-dark-100 text-sm truncate">{ch.name}</span>
                    </Link>
                  ))}
                </div>
              )}

              {results.vods.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-dark-400 uppercase flex items-center gap-2">
                    <Film size={14} /> {t("nav.vod")}
                  </div>
                  {results.vods.map((v) => (
                    <Link
                      key={`vod-${v.id}`}
                      href={`/vod/${v.id}`}
                      onClick={handleClose}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-dark-700/50 transition-colors"
                    >
                      <div className="relative w-8 h-10 rounded bg-dark-700 flex items-center justify-center overflow-hidden shrink-0">
                        {v.poster_url ? (
                          <Image src={v.poster_url} alt={v.title} fill sizes="32px" className="object-cover" />
                        ) : (
                          <Film size={14} className="text-dark-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-dark-100 text-sm truncate">{v.title}</p>
                        {v.year > 0 && <p className="text-dark-400 text-xs">{v.year}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results.series.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-dark-400 uppercase flex items-center gap-2">
                    <BookOpen size={14} /> {t("nav.series")}
                  </div>
                  {results.series.map((s) => (
                    <Link
                      key={`ser-${s.id}`}
                      href={`/series/${s.id}`}
                      onClick={handleClose}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-dark-700/50 transition-colors"
                    >
                      <div className="relative w-8 h-10 rounded bg-dark-700 flex items-center justify-center overflow-hidden shrink-0">
                        {s.poster_url ? (
                          <Image src={s.poster_url} alt={s.title} fill sizes="32px" className="object-cover" />
                        ) : (
                          <BookOpen size={14} className="text-dark-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-dark-100 text-sm truncate">{s.title}</p>
                        {s.year > 0 && <p className="text-dark-400 text-xs">{s.year}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
