"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminAPI } from "@/lib/api";
import { useToast } from "@/context/toast-context";
import type { IPTVImportStatus } from "@/lib/types";

// ─── Datos estáticos ─────────────────────────────────────────────────────────

const PRESET_URLS = [
  { label: "🌍 Todos los países (index.m3u)", value: "https://iptv-org.github.io/iptv/index.m3u" },
  { label: "🇪🇸 España", value: "https://iptv-org.github.io/iptv/countries/es.m3u" },
  { label: "🇲🇽 México", value: "https://iptv-org.github.io/iptv/countries/mx.m3u" },
  { label: "🇦🇷 Argentina", value: "https://iptv-org.github.io/iptv/countries/ar.m3u" },
  { label: "🇨🇴 Colombia", value: "https://iptv-org.github.io/iptv/countries/co.m3u" },
  { label: "🇨🇱 Chile", value: "https://iptv-org.github.io/iptv/countries/cl.m3u" },
  { label: "🇵🇪 Perú", value: "https://iptv-org.github.io/iptv/countries/pe.m3u" },
  { label: "🇻🇪 Venezuela", value: "https://iptv-org.github.io/iptv/countries/ve.m3u" },
  { label: "🇺🇸 Estados Unidos", value: "https://iptv-org.github.io/iptv/countries/us.m3u" },
  { label: "🇬🇧 Reino Unido", value: "https://iptv-org.github.io/iptv/countries/gb.m3u" },
  { label: "🇫🇷 Francia", value: "https://iptv-org.github.io/iptv/countries/fr.m3u" },
  { label: "🇩🇪 Alemania", value: "https://iptv-org.github.io/iptv/countries/de.m3u" },
  { label: "🇮🇹 Italia", value: "https://iptv-org.github.io/iptv/countries/it.m3u" },
  { label: "🇵🇹 Portugal", value: "https://iptv-org.github.io/iptv/countries/pt.m3u" },
  { label: "🇧🇷 Brasil", value: "https://iptv-org.github.io/iptv/countries/br.m3u" },
  { label: "🌎 Latinoamérica (región)", value: "https://iptv-org.github.io/iptv/regions/lac.m3u" },
  { label: "🌍 Hispanohablantes (idioma)", value: "https://iptv-org.github.io/iptv/languages/spa.m3u" },
  { label: "🔗 URL personalizada", value: "custom" },
];

const COUNTRY_OPTIONS = [
  { code: "ES", label: "España" }, { code: "MX", label: "México" },
  { code: "AR", label: "Argentina" }, { code: "CO", label: "Colombia" },
  { code: "CL", label: "Chile" }, { code: "PE", label: "Perú" },
  { code: "VE", label: "Venezuela" }, { code: "US", label: "Estados Unidos" },
  { code: "GB", label: "Reino Unido" }, { code: "FR", label: "Francia" },
  { code: "DE", label: "Alemania" }, { code: "IT", label: "Italia" },
  { code: "PT", label: "Portugal" }, { code: "BR", label: "Brasil" },
  { code: "TR", label: "Turquía" }, { code: "RU", label: "Rusia" },
];

const LANGUAGE_OPTIONS = [
  { code: "Spanish", label: "Español" }, { code: "English", label: "Inglés" },
  { code: "Portuguese", label: "Portugués" }, { code: "French", label: "Francés" },
  { code: "German", label: "Alemán" }, { code: "Italian", label: "Italiano" },
  { code: "Arabic", label: "Árabe" }, { code: "Turkish", label: "Turco" },
  { code: "Russian", label: "Ruso" }, { code: "Hindi", label: "Hindi" },
];

const CATEGORY_OPTIONS = [
  "News", "Sports", "Entertainment", "Movies", "Series",
  "Kids", "Music", "Documentary", "Religion", "Travel",
  "Science", "Comedy", "Education", "Shop", "XXX",
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function IPTVPage() {
  const toast = useToast();

  // Formulario
  const [presetURL, setPresetURL] = useState(PRESET_URLS[0].value);
  const [customURL, setCustomURL] = useState("");
  const [epgURL, setEpgURL] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [replace, setReplace] = useState(true);
  const [source, setSource] = useState("iptv-org");
  const [showConfirm, setShowConfirm] = useState(false);

  // Estado de importación
  const [status, setStatus] = useState<IPTVImportStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estadísticas
  const [channelCount, setChannelCount] = useState<{ total: number; iptv: number } | null>(null);

  // ── Poll de estado ─────────────────────────────────────────────────────────

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const res = await adminAPI.iptvStatus();
        setStatus(res.data.data);
        if (!res.data.data.running) {
          stopPoll();
          // Refrescar stats
          fetchStats();
        }
      } catch {
        stopPoll();
      }
    }, 1500);
  }, [stopPoll]);

  const fetchStats = useCallback(async () => {
    try {
      const statsRes = await adminAPI.getStats();
      const total = statsRes.data.data.channels;
      setChannelCount({ total, iptv: 0 }); // iptv count requiere endpoint adicional
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    // Verificar si hay importación en curso al cargar
    adminAPI.iptvStatus().then((res) => {
      setStatus(res.data.data);
      if (res.data.data.running) startPoll();
    }).catch(() => {});
    fetchStats();
    return () => stopPoll();
  }, [startPoll, stopPoll, fetchStats]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const getM3UURL = () => (presetURL === "custom" ? customURL : presetURL);

  const handleImport = async () => {
    setShowConfirm(false);
    const m3uURL = getM3UURL();
    if (!m3uURL) { toast.error("Introduce una URL M3U"); return; }

    try {
      await adminAPI.iptvImport({
        m3u_url: m3uURL,
        epg_url: epgURL || undefined,
        countries: selectedCountries.length > 0 ? selectedCountries : undefined,
        languages: selectedLanguages.length > 0 ? selectedLanguages : undefined,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        replace,
        source,
      });
      toast.success("Importación iniciada en segundo plano");
      startPoll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Error iniciando importación");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar todos los canales con source="${source}"? Los canales manuales NO se borrarán.`)) return;
    try {
      await adminAPI.iptvDeleteBySource(source);
      toast.success("Canales IPTV eliminados");
      fetchStats();
    } catch {
      toast.error("Error eliminando canales");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isRunning = status?.running ?? false;
  const m3uURL = getM3UURL();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-bold text-dark-100">Importación IPTV</h1>
        <p className="text-dark-400 text-sm mt-1">
          Importa canales desde cualquier lista M3U. Los canales creados manualmente
          <span className="text-primary-400 font-medium"> nunca se borran</span>, incluso al reimportar.
        </p>
      </div>

      {/* Stats */}
      {channelCount && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <p className="text-dark-400 text-xs uppercase tracking-wider">Total canales</p>
            <p className="text-3xl font-bold text-dark-100 mt-1">{channelCount.total.toLocaleString()}</p>
          </div>
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <p className="text-dark-400 text-xs uppercase tracking-wider">Fuente activa</p>
            <p className="text-3xl font-bold text-primary-400 mt-1 font-mono text-xl">{source}</p>
          </div>
        </div>
      )}

      {/* Progreso de importación */}
      {status && (isRunning || status.message) && (
        <div className="bg-dark-800 rounded-xl p-5 border border-dark-700 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse" />
              )}
              <span className={`text-sm font-medium ${isRunning ? "text-primary-300" : status.error ? "text-red-400" : "text-green-400"}`}>
                {isRunning ? "Importando..." : status.error ? "Error" : "Completado"}
              </span>
            </div>
            {isRunning && (
              <span className="text-dark-400 text-sm">{status.current.toLocaleString()} / {status.total.toLocaleString()}</span>
            )}
          </div>

          {/* Barra de progreso */}
          {status.total > 0 && (
            <div className="w-full bg-dark-700 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${status.percent}%` }}
              />
            </div>
          )}

          <p className="text-dark-300 text-sm">{status.error || status.message}</p>

          {!isRunning && status.imported > 0 && (
            <p className="text-green-400 text-sm font-medium">
              ✓ {status.imported.toLocaleString()} canales importados
            </p>
          )}
        </div>
      )}

      {/* Formulario */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 space-y-6">

        {/* URL del M3U */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-200">Fuente M3U</label>
          <select
            value={presetURL}
            onChange={(e) => setPresetURL(e.target.value)}
            disabled={isRunning}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2.5 text-dark-100 text-sm focus:outline-none focus:border-primary-500 disabled:opacity-50"
          >
            {PRESET_URLS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {presetURL === "custom" && (
            <input
              type="url"
              placeholder="https://ejemplo.com/lista.m3u"
              value={customURL}
              onChange={(e) => setCustomURL(e.target.value)}
              disabled={isRunning}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2.5 text-dark-100 text-sm focus:outline-none focus:border-primary-500 disabled:opacity-50"
            />
          )}
          {m3uURL && presetURL !== "custom" && (
            <p className="text-dark-500 text-xs font-mono break-all">{m3uURL}</p>
          )}
        </div>

        {/* URL EPG opcional */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-200">URL EPG (XMLTV, opcional)</label>
          <input
            type="url"
            placeholder="https://ejemplo.com/epg.xml.gz  — dejar vacío para usar la del M3U"
            value={epgURL}
            onChange={(e) => setEpgURL(e.target.value)}
            disabled={isRunning}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2.5 text-dark-100 text-sm focus:outline-none focus:border-primary-500 disabled:opacity-50"
          />
        </div>

        {/* Filtro por país */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-200">
            Filtrar por país{" "}
            <span className="text-dark-500 font-normal">(vacío = todos)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {COUNTRY_OPTIONS.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleItem(selectedCountries, setSelectedCountries, c.code)}
                disabled={isRunning}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                  selectedCountries.includes(c.code)
                    ? "bg-primary-600/30 border-primary-500 text-primary-300"
                    : "bg-dark-700 border-dark-600 text-dark-300 hover:border-dark-500"
                }`}
              >
                {c.label} ({c.code})
              </button>
            ))}
          </div>
        </div>

        {/* Filtro por idioma */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-200">
            Filtrar por idioma{" "}
            <span className="text-dark-500 font-normal">(vacío = todos)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => toggleItem(selectedLanguages, setSelectedLanguages, l.code)}
                disabled={isRunning}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                  selectedLanguages.includes(l.code)
                    ? "bg-blue-600/30 border-blue-500 text-blue-300"
                    : "bg-dark-700 border-dark-600 text-dark-300 hover:border-dark-500"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro por categoría */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-200">
            Filtrar por categoría{" "}
            <span className="text-dark-500 font-normal">(vacío = todas)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleItem(selectedCategories, setSelectedCategories, cat)}
                disabled={isRunning}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                  selectedCategories.includes(cat)
                    ? "bg-green-600/30 border-green-500 text-green-300"
                    : "bg-dark-700 border-dark-600 text-dark-300 hover:border-dark-500"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Opciones avanzadas */}
        <div className="border-t border-dark-700 pt-4 space-y-4">
          <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Opciones avanzadas</p>

          {/* Source tag */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-dark-200">Etiqueta de fuente</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={isRunning}
              placeholder="iptv-org"
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-dark-100 text-sm font-mono focus:outline-none focus:border-primary-500 disabled:opacity-50"
            />
            <p className="text-dark-500 text-xs">
              Identifica el origen. Canales manuales tienen etiqueta vacía y <strong className="text-dark-400">nunca se tocan</strong>.
            </p>
          </div>

          {/* Replace toggle */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              disabled={isRunning}
              className="mt-0.5 w-4 h-4 rounded border-dark-600 bg-dark-700 accent-primary-500 disabled:opacity-50"
            />
            <div>
              <span className="text-sm text-dark-200 font-medium">Reemplazar canales IPTV existentes</span>
              <p className="text-dark-500 text-xs mt-0.5">
                Elimina los canales con la etiqueta &quot;{source}&quot; antes de importar.
                Los canales manuales <strong className="text-green-400">nunca se borran</strong>.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Resumen de filtros activos */}
      {(selectedCountries.length > 0 || selectedLanguages.length > 0 || selectedCategories.length > 0) && (
        <div className="bg-dark-800/50 rounded-lg p-3 border border-dark-700 text-xs text-dark-400 space-y-1">
          <p className="font-semibold text-dark-300">Filtros activos:</p>
          {selectedCountries.length > 0 && <p>🌍 Países: {selectedCountries.join(", ")}</p>}
          {selectedLanguages.length > 0 && <p>🗣️ Idiomas: {selectedLanguages.join(", ")}</p>}
          {selectedCategories.length > 0 && <p>📁 Categorías: {selectedCategories.join(", ")}</p>}
          <button
            onClick={() => { setSelectedCountries([]); setSelectedLanguages([]); setSelectedCategories([]); }}
            className="text-red-400 hover:text-red-300 mt-1"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-3">
        {!showConfirm ? (
          <button
            onClick={() => replace ? setShowConfirm(true) : handleImport()}
            disabled={isRunning || !m3uURL}
            className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {isRunning ? "⏳ Importando..." : "▶ Iniciar importación"}
          </button>
        ) : (
          <div className="flex-1 bg-dark-800 border border-yellow-500/50 rounded-xl p-4 space-y-3">
            <p className="text-yellow-300 text-sm font-medium">
              ⚠️ Se eliminarán los canales con etiqueta <code className="bg-dark-700 px-1 rounded">{source}</code> antes de importar.
              Los canales manuales están protegidos.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
              >
                Confirmar y continuar
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 bg-dark-700 hover:bg-dark-600 text-dark-300 font-semibold py-2 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={isRunning}
          title={`Eliminar canales con source="${source}"`}
          className="px-4 bg-dark-800 hover:bg-red-900/30 border border-dark-700 hover:border-red-700/50 text-dark-400 hover:text-red-400 rounded-xl transition-colors disabled:opacity-50"
        >
          🗑️
        </button>
      </div>

      {/* Info */}
      <div className="bg-dark-800/30 rounded-xl border border-dark-700/50 p-4 text-xs text-dark-500 space-y-1">
        <p className="font-semibold text-dark-400">ℹ️ Cómo funciona</p>
        <p>• Los canales IPTV llevan la etiqueta de fuente que configures (por defecto: <code className="bg-dark-700 px-1 rounded">iptv-org</code>).</p>
        <p>• Los canales creados manualmente desde el panel tienen etiqueta vacía y <strong className="text-green-400">nunca se eliminarán</strong> en ninguna reimportación.</p>
        <p>• Puedes tener múltiples fuentes IPTV usando diferentes etiquetas (ej: <code className="bg-dark-700 px-1 rounded">mi-proveedor</code>).</p>
        <p>• La importación se ejecuta en segundo plano; el servidor sigue funcionando con normalidad.</p>
      </div>
    </div>
  );
}
