"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Tv } from "lucide-react";
import { useTranslation } from "react-i18next";
import { userAPI } from "@/lib/api";
import type { ChannelList, Category } from "@/lib/types";
import { useToast } from "@/context/toast-context";
import Pagination from "@/components/ui/pagination";
import SearchInput from "@/components/ui/search-input";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { PAGINATION_DEFAULT_PER_PAGE, LIVE_CHANNELS_POLL_INTERVAL_MS } from "@/lib/constants";
import { getChannelUrl } from "@/lib/routes";

const PER_PAGE = 24;

export default function ChannelsPage() {
  const toast = useToast();
  const { t } = useTranslation();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const isMountedRef = useRef(true);

  const [channels, setChannels] = useState<ChannelList[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [liveChannelIds, setLiveChannelIds] = useState<Set<number>>(new Set());

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await userAPI.getCategories("live");
      if (isMountedRef.current && data.data) {
        setCategories(data.data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        toastRef.current.error(t("common.errorLoadingCategories"));
      }
    }
  }, [t]);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.getChannels(page, PER_PAGE, search || undefined, selectedCategory);
      if (isMountedRef.current) {
        setChannels(data.data || []);
        setTotalPages(data.meta.pages);
      }
    } catch (err) {
      if (isMountedRef.current) {
        toastRef.current.error(t("channels.errorLoadingChannels"));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [page, selectedCategory, search, t]);

  const fetchLiveChannels = useCallback(async () => {
    try {
      const { data } = await userAPI.getLiveChannels();
      if (isMountedRef.current) {
        if (data.data?.live_channel_ids) {
          setLiveChannelIds(new Set(data.data.live_channel_ids));
        } else {
          setLiveChannelIds(new Set());
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.warn("Failed to fetch live channels:", err);
      }
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    fetchLiveChannels();
    const interval = setInterval(fetchLiveChannels, LIVE_CHANNELS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchLiveChannels]);

  useEffect(() => {
    document.title = `${t("nav.channels")} | TIVIFY`;
    return () => {
      isMountedRef.current = false;
    };
  }, [t]);

  const handleCategoryChange = useCallback((categoryId: number | undefined) => {
    setSelectedCategory(categoryId);
    setPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const channelsWithStatus = useMemo(() => {
    return channels.map(ch => ({
      ...ch,
      isLive: liveChannelIds.has(ch.id)
    }));
  }, [channels, liveChannelIds]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-dark-100">{t("channels.title")}</h1>
        <div className="w-full sm:w-64">
          <SearchInput value={search} onChange={handleSearch} placeholder={t("channels.searchPlaceholder")} />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mb-6">
          <select
            value={selectedCategory ?? ""}
            onChange={(e) => handleCategoryChange(e.target.value ? Number(e.target.value) : undefined)}
            className="input-field w-full sm:w-72 text-sm cursor-pointer"
          >
            <option value="">{t("channels.allCategories")}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <LoadingSpinner text={t("channels.loadingChannels")} />
      ) : channels.length === 0 ? (
        <div className="text-center py-12">
          <Tv size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-dark-400">{t("channels.noChannelsFound")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel) => (
              <Link
                key={channel.id}
                href={getChannelUrl(channel.id)}
                className="bg-dark-800 border border-dark-700 rounded-xl p-4 hover:border-primary-500/50 transition-colors cursor-pointer block"
                aria-label={`Watch channel: ${channel.name}`}
              >
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-lg bg-dark-700 flex items-center justify-center overflow-hidden shrink-0">
                    {channel.logo_url ? (
                      <Image
                        src={channel.logo_url}
                        alt={`Logo for ${channel.name}`}
                        fill
                        sizes="64px"
                        className="object-contain"
                      />
                    ) : (
                      <Tv size={28} className="text-dark-500" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-dark-100 font-semibold truncate">{channel.name}</h3>
                      {liveChannelIds.has(channel.id) && (
                        <span className="flex items-center gap-1 shrink-0" aria-label="Channel is currently live">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true" />
                          <span className="text-[10px] font-bold text-red-400 uppercase">{t("channels.live")}</span>
                        </span>
                      )}
                    </div>
                    {channel.category && (
                      <p className="text-sm text-dark-400 truncate">{channel.category.name}</p>
                    )}
                    {channel.channel_number !== null && (
                      <span className="inline-block mt-1 text-xs bg-dark-700 text-dark-300 px-2 py-0.5 rounded-full">
                        {t("channels.channelNumber")} {channel.channel_number}
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
