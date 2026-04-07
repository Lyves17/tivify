"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { Calendar, Tv, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { userAPI } from "@/lib/api";
import type { ChannelList, EPGEntry } from "@/lib/types";
import { useToast } from "@/context/toast-context";
import LoadingSpinner from "@/components/ui/loading-spinner";

function formatTime(dateStr: string, lang: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(lang === "en" ? "en-US" : "es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(date: Date, lang: string): string {
  return date.toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isNowPlaying(start: string, end: string): boolean {
  const now = new Date();
  return now >= new Date(start) && now <= new Date(end);
}

export default function GuidePage() {
  const toast = useToast();
  const { t, i18n } = useTranslation();
  const [channels, setChannels] = useState<ChannelList[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [epgEntries, setEpgEntries] = useState<EPGEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingEPG, setLoadingEPG] = useState(false);

  const fetchChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const { data } = await userAPI.getChannels(1, 100);
      const channelList = data.data || [];
      setChannels(channelList);
      if (channelList.length > 0 && !selectedChannelId) {
        setSelectedChannelId(channelList[0].id);
      }
    } catch {
      toast.error(t("guide.errorLoadingChannels"));
    } finally {
      setLoadingChannels(false);
    }
  }, [toast, selectedChannelId, t]);

  const fetchEPG = useCallback(async () => {
    if (!selectedChannelId) return;
    setLoadingEPG(true);
    try {
      const dateStr = toDateString(selectedDate);
      const { data } = await userAPI.getEPG(selectedChannelId, dateStr);
      setEpgEntries(data.data || []);
    } catch {
      toast.error(t("guide.errorLoadingSchedule"));
    } finally {
      setLoadingEPG(false);
    }
  }, [selectedChannelId, selectedDate, toast, t]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    fetchEPG();
  }, [fetchEPG]);

  const changeDate = (days: number) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
  };

  const setToday = () => setSelectedDate(new Date());

  const dateButtons = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return { yesterday, today, tomorrow };
  }, []);

  const isToday = toDateString(selectedDate) === toDateString(dateButtons.today);

  if (loadingChannels) {
    return <LoadingSpinner text={t("guide.loadingChannels")} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t("guide.title")}</h1>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => changeDate(-1)}
          className="btn-secondary p-2"
          title={t("guide.previousDay")}
        >
          <ChevronLeft size={18} />
        </button>

        <button
          onClick={() => setSelectedDate(dateButtons.yesterday)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            toDateString(selectedDate) === toDateString(dateButtons.yesterday)
              ? "bg-primary-600 text-white"
              : "btn-secondary"
          }`}
        >
          {t("guide.yesterday")}
        </button>
        <button
          onClick={setToday}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isToday ? "bg-primary-600 text-white" : "btn-secondary"
          }`}
        >
          {t("guide.today")}
        </button>
        <button
          onClick={() => setSelectedDate(dateButtons.tomorrow)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            toDateString(selectedDate) === toDateString(dateButtons.tomorrow)
              ? "bg-primary-600 text-white"
              : "btn-secondary"
          }`}
        >
          {t("guide.tomorrow")}
        </button>

        <button
          onClick={() => changeDate(1)}
          className="btn-secondary p-2"
          title={t("guide.nextDay")}
        >
          <ChevronRight size={18} />
        </button>

        <div className="flex items-center gap-2 ml-2">
          <Calendar size={16} className="text-dark-400" />
          <input
            type="date"
            value={toDateString(selectedDate)}
            onChange={(e) => setSelectedDate(new Date(e.target.value + "T12:00:00"))}
            className="input-field py-1.5 text-sm w-auto"
          />
        </div>

        <span className="text-sm text-dark-400 ml-2">
          {formatDateLabel(selectedDate, i18n.language)}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-72 shrink-0">
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-dark-700">
              <h2 className="text-sm font-semibold text-dark-200">{t("guide.channels")}</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {channels.length === 0 ? (
                <p className="text-dark-400 text-sm p-4">{t("guide.noChannels")}</p>
              ) : (
                channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannelId(ch.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      selectedChannelId === ch.id
                        ? "bg-primary-600/20 border-l-2 border-primary-500"
                        : "hover:bg-dark-700 border-l-2 border-transparent"
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-dark-700 flex items-center justify-center overflow-hidden shrink-0 relative">
                      {ch.logo_url ? (
                        <Image src={ch.logo_url} alt={ch.name} fill className="object-contain" sizes="32px" />
                      ) : (
                        <Tv size={14} className="text-dark-500" />
                      )}
                    </div>
                    <span
                      className={`text-sm truncate ${
                        selectedChannelId === ch.id ? "text-primary-400 font-medium" : "text-dark-300"
                      }`}
                    >
                      {ch.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-dark-700">
              <h2 className="text-sm font-semibold text-dark-200">
                {t("guide.schedule")}
                {selectedChannelId && channels.length > 0 && (
                  <span className="text-dark-400 font-normal ml-2">
                    - {channels.find((c) => c.id === selectedChannelId)?.name}
                  </span>
                )}
              </h2>
            </div>

            <div className="p-4">
              {!selectedChannelId ? (
                <p className="text-dark-400 text-sm text-center py-8">{t("guide.selectChannel")}</p>
              ) : loadingEPG ? (
                <LoadingSpinner text={t("guide.loadingSchedule")} />
              ) : epgEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={40} className="mx-auto text-dark-600 mb-3" />
                  <p className="text-dark-400 text-sm">{t("guide.noSchedule")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {epgEntries.map((entry) => {
                    const nowPlaying = isNowPlaying(entry.start_time, entry.end_time);
                    return (
                      <div
                        key={entry.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          nowPlaying
                            ? "bg-primary-600/10 border-primary-500/50"
                            : "bg-dark-900/50 border-dark-700 hover:border-dark-600"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-right shrink-0 w-24">
                            <span className={`text-sm font-mono ${nowPlaying ? "text-primary-400 font-semibold" : "text-dark-300"}`}>
                              {formatTime(entry.start_time, i18n.language)}
                            </span>
                            <span className="text-dark-500 mx-1">-</span>
                            <span className={`text-sm font-mono ${nowPlaying ? "text-primary-400" : "text-dark-400"}`}>
                              {formatTime(entry.end_time, i18n.language)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-medium text-sm ${nowPlaying ? "text-primary-300" : "text-dark-100"}`}>
                                {entry.title}
                              </h3>
                              {nowPlaying && (
                                <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">
                                  {t("guide.live")}
                                </span>
                              )}
                            </div>
                            {entry.category && (
                              <span className="text-xs text-dark-400 mt-0.5 inline-block">{entry.category}</span>
                            )}
                            {entry.description && (
                              <p className="text-dark-400 text-xs mt-1 line-clamp-2">{entry.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
