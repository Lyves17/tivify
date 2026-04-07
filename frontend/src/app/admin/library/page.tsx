"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Download, Check, Film, Tv, HardDrive, RefreshCw, Database, AlertTriangle } from "lucide-react";
import Pagination from "@/components/ui/pagination";
import Modal from "@/components/ui/modal";
import FormInput from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import { adminAPI } from "@/lib/api";
import { useToast } from "@/context/toast-context";
import type { LibraryScanItem, ScanStatusResponse, TMDBSearchResult, StorageDevice } from "@/lib/types";
import { formatDurationHuman as formatDuration } from "@/lib/utils";

type FilterType = "all" | "movie" | "series" | "direct" | "transcode";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}


export default function LibraryPage() {
  const toast = useToast();

  // Scan state
  const [scanState, setScanState] = useState<"idle" | "device-select" | "scanning" | "results">("idle");
  const [sessionId, setSessionId] = useState<string>("");
  const [scanStatus, setScanStatus] = useState<ScanStatusResponse | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Device selection
  const [devices, setDevices] = useState<StorageDevice[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Results
  const [items, setItems] = useState<LibraryScanItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<FilterType>("all");

  // Edit modal
  const [editItem, setEditItem] = useState<LibraryScanItem | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // TMDB search modal
  const [tmdbModalOpen, setTmdbModalOpen] = useState(false);
  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbYear, setTmdbYear] = useState("");
  const [tmdbType, setTmdbType] = useState("movie");
  const [tmdbResults, setTmdbResults] = useState<TMDBSearchResult[]>([]);
  const [tmdbSearching, setTmdbSearching] = useState(false);

  // TMDB status
  const [tmdbStatus, setTmdbStatus] = useState<{ configured: boolean; valid: boolean; message: string } | null>(null);

  // Import state
  const [importing, setImporting] = useState(false);

  const fetchResults = useCallback(async (sid: string, p: number) => {
    setLoading(true);
    try {
      const res = await adminAPI.getScanResults(sid, p, 50);
      setItems(res.data.data || []);
      setTotalPages(res.data.meta.pages);
    } catch {
      toast.error("Error al cargar resultados");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const res = await adminAPI.getLibraryDevices();
      setDevices(res.data.data || []);
      // Auto-select first device if available
      if (res.data.data && res.data.data.length > 0) {
        setSelectedDevices(new Set([res.data.data[0].path]));
      }
    } catch {
      toast.error("Error al cargar dispositivos");
      setDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  };

  // Load TMDB status and cleanup polling on unmount
  useEffect(() => {
    adminAPI.getTMDBStatus().then((res) => {
      setTmdbStatus(res.data.data);
    }).catch(() => {
      // ignore
    });
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Fetch results when page changes
  useEffect(() => {
    if (scanState === "results" && sessionId) {
      fetchResults(sessionId, page);
    }
  }, [page, scanState, sessionId, fetchResults]);

  const openDeviceSelection = async () => {
    await loadDevices();
    setScanState("device-select");
  };

  const startScan = async () => {
    try {
      const paths = selectedDevices.size > 0 ? Array.from(selectedDevices) : undefined;
      const res = await adminAPI.scanLibrary(paths);
      const sid = res.data.data.session_id;
      setSessionId(sid);
      setScanState("scanning");
      setScanStatus({ session_id: sid, status: "scanning", total_files: 0, scanned: 0 });

      // Start polling
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await adminAPI.getScanStatus(sid);
          const status = statusRes.data.data;
          setScanStatus(status);

          if (status.status === "completed" || status.status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            if (status.status === "completed") {
              setScanState("results");
              setPage(1);
              fetchResults(sid, 1);
              toast.success(`Escaneo completado: ${status.total_files} archivos encontrados`);
            } else {
              toast.error("Escaneo fallido: " + (status.error || "Error desconocido"));
              setScanState("idle");
            }
          }
        } catch {
          // Keep polling
        }
      }, 2000);
    } catch {
      toast.error("Error al iniciar escaneo");
    }
  };

  const toggleDeviceSelection = (path: string) => {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const filteredItems = items.filter((item) => {
    switch (filter) {
      case "movie": return item.media_type === "movie";
      case "series": return item.media_type === "series";
      case "direct": return !item.needs_transcode;
      case "transcode": return item.needs_transcode;
      default: return true;
    }
  });

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const pendingIds = filteredItems.filter((i) => i.import_status === "pending").map((i) => i.id);
    setSelected(new Set(pendingIds));
  };

  const deselectAll = () => setSelected(new Set());

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const res = await adminAPI.importLibraryItems(sessionId, Array.from(selected));
      const data = res.data.data;
      toast.success(`Importados: ${data.imported}, Fallidos: ${data.failed}`);
      setSelected(new Set());
      fetchResults(sessionId, page);
    } catch {
      toast.error("Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const openEdit = (item: LibraryScanItem) => {
    setEditItem(item);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!editItem) return;
    try {
      await adminAPI.updateScanItem(editItem.id, {
        parsed_title: editItem.parsed_title,
        parsed_year: editItem.parsed_year,
        media_type: editItem.media_type,
        season_number: editItem.season_number,
        episode_number: editItem.episode_number,
        tmdb_id: editItem.tmdb_id,
        tmdb_title: editItem.tmdb_title,
        tmdb_year: editItem.tmdb_year,
        tmdb_poster_url: editItem.tmdb_poster_url,
        tmdb_backdrop_url: editItem.tmdb_backdrop_url,
        tmdb_description: editItem.tmdb_description,
        tmdb_rating: editItem.tmdb_rating,
        tmdb_series_name: editItem.tmdb_series_name,
      });
      toast.success("Item actualizado");
      setEditModalOpen(false);
      fetchResults(sessionId, page);
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const openTMDBSearch = () => {
    if (!editItem) return;
    setTmdbQuery(editItem.parsed_title);
    setTmdbYear(editItem.parsed_year ? String(editItem.parsed_year) : "");
    setTmdbType(editItem.media_type === "series" ? "series" : "movie");
    setTmdbResults([]);
    setTmdbModalOpen(true);
  };

  const searchTMDB = async () => {
    if (!tmdbQuery.trim()) return;
    setTmdbSearching(true);
    try {
      const res = await adminAPI.searchTMDB(tmdbQuery, tmdbYear ? Number(tmdbYear) : 0, tmdbType);
      setTmdbResults(res.data.data || []);
    } catch {
      toast.error("Error buscando en TMDB");
    } finally {
      setTmdbSearching(false);
    }
  };

  const applyTMDBResult = (result: TMDBSearchResult) => {
    if (!editItem) return;
    setEditItem({
      ...editItem,
      tmdb_id: result.id,
      tmdb_title: result.title,
      tmdb_year: result.year,
      tmdb_poster_url: result.poster_url,
      tmdb_backdrop_url: result.backdrop_url,
      tmdb_description: result.overview,
      tmdb_rating: result.rating,
    });
    setTmdbModalOpen(false);
    toast.success("Metadatos TMDB aplicados");
  };

  // === IDLE STATE ===
  if (scanState === "idle") {
    return (
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100 mb-6">Biblioteca</h1>
        <div className="flex flex-col items-center justify-center py-20">
          <HardDrive size={64} className="text-dark-500 mb-4" />
          <h2 className="text-lg font-semibold text-dark-200 mb-2">Escanear Biblioteca de Medios</h2>
          <p className="text-dark-400 text-sm text-center max-w-md mb-6">
            Escanea tu disco externo para detectar peliculas y series automaticamente.
            Los archivos MP4 (h264+aac) se reproduciran directamente, el resto se transcodificara.
          </p>
          <button
            onClick={openDeviceSelection}
            className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
          >
            <Search size={20} />
            Escanear Biblioteca
          </button>
          {tmdbStatus && !tmdbStatus.configured && (
            <div className="mt-6 flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 max-w-md">
              <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-300 text-sm font-medium">TMDB no configurado</p>
                <p className="text-dark-400 text-xs mt-1">
                  Sin API key de TMDB, los archivos se importaran sin metadatos (poster, sinopsis, rating).
                  Configura TMDB_API_KEY en el archivo .env para habilitar la busqueda automatica.
                </p>
                <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer"
                  className="text-primary-400 text-xs hover:text-primary-300 mt-1 inline-block">
                  Obtener API key gratis →
                </a>
              </div>
            </div>
          )}
          {tmdbStatus && tmdbStatus.configured && !tmdbStatus.valid && (
            <div className="mt-6 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 max-w-md">
              <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 text-sm font-medium">TMDB API key invalida</p>
                <p className="text-dark-400 text-xs mt-1">{tmdbStatus.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // === DEVICE SELECTION STATE ===
  if (scanState === "device-select") {
    return (
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100 mb-6">Seleccionar Dispositivos</h1>
        <div className="max-w-2xl">
          <p className="text-dark-400 text-sm mb-6">
            Selecciona uno o más dispositivos de almacenamiento para escanear.
          </p>

          {loadingDevices ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={32} className="text-primary-500 animate-spin" />
            </div>
          ) : devices.length === 0 ? (
            <div className="rounded-lg bg-dark-800 p-6 text-center">
              <Database size={32} className="text-dark-500 mx-auto mb-3" />
              <p className="text-dark-400 text-sm">No se encontraron dispositivos con archivos de video</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {devices.map((device) => {
                const usagePercent = device.total_bytes > 0 ? Math.round((device.used_bytes / device.total_bytes) * 100) : 0;
                const totalGB = (device.total_bytes / (1024 ** 3)).toFixed(1);
                const freeGB = (device.free_bytes / (1024 ** 3)).toFixed(1);

                return (
                  <div
                    key={device.path}
                    onClick={() => toggleDeviceSelection(device.path)}
                    className={`rounded-lg p-4 border-2 cursor-pointer transition-colors ${
                      selectedDevices.has(device.path)
                        ? "border-primary-500 bg-primary-500/10"
                        : "border-dark-700 bg-dark-800 hover:border-dark-600"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedDevices.has(device.path)}
                        onChange={() => {}}
                        className="h-5 w-5 rounded border-dark-600 bg-dark-700 text-primary-600 mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-dark-100">{device.name}</p>
                            <p className="text-xs text-dark-500">{device.filesystem}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-dark-100">{device.video_files}</p>
                            <p className="text-xs text-dark-500">archivos de video</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="w-full bg-dark-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary-500 h-full transition-all"
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-dark-400">
                            {device.used_bytes > 0 ? `${(device.used_bytes / (1024 ** 3)).toFixed(1)} GB` : "0 GB"} de {totalGB} GB · {freeGB} GB libres
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setScanState("idle")}
              className="btn-secondary px-6 py-2"
            >
              Cancelar
            </button>
            <button
              onClick={startScan}
              disabled={selectedDevices.size === 0 || loadingDevices}
              className="btn-primary flex items-center gap-2 px-6 py-2"
            >
              <Search size={16} />
              Escanear {selectedDevices.size > 0 ? `(${selectedDevices.size})` : ""}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === SCANNING STATE ===
  if (scanState === "scanning") {
    return (
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100 mb-6">Biblioteca</h1>
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw size={48} className="text-primary-500 mb-4 animate-spin" />
          <h2 className="text-lg font-semibold text-dark-200 mb-2">Escaneando...</h2>
          <p className="text-dark-400 text-sm mb-4">
            Analizando archivos de video, detectando codecs y buscando metadatos en TMDB
          </p>
          {scanStatus && (
            <div className="bg-dark-800 rounded-lg px-6 py-4 text-center">
              <p className="text-2xl font-bold text-primary-400">{scanStatus.scanned}</p>
              <p className="text-dark-400 text-sm">archivos procesados</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // === RESULTS STATE ===
  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100">Biblioteca</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openDeviceSelection}
            className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
          >
            <RefreshCw size={14} />
            Re-escanear
          </button>
          {selected.size > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
            >
              <Download size={14} />
              {importing ? "Importando..." : `Importar (${selected.size})`}
            </button>
          )}
        </div>
      </div>

      {/* Filters + selection bar */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "movie", "series", "direct", "transcode"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary-600 text-white"
                  : "bg-dark-800 text-dark-300 hover:bg-dark-700"
              }`}
            >
              {f === "all" ? "Todo" : f === "movie" ? "Peliculas" : f === "series" ? "Series" : f === "direct" ? "Directo" : "Transcodificar"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={selectAll} className="text-xs text-dark-400 hover:text-dark-200 transition-colors">
            Seleccionar todo
          </button>
          <span className="text-dark-600">|</span>
          <button onClick={deselectAll} className="text-xs text-dark-400 hover:text-dark-200 transition-colors">
            Deseleccionar
          </button>
        </div>
      </div>

      {/* Results table */}
      <div className="overflow-x-auto rounded-lg border border-dark-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-700 bg-dark-800/50">
              <th className="px-3 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === filteredItems.filter((i) => i.import_status === "pending").length}
                  onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                  className="h-4 w-4 rounded border-dark-600 bg-dark-700 text-primary-600"
                />
              </th>
              <th className="px-3 py-3 text-left w-12"></th>
              <th className="px-3 py-3 text-left text-dark-300 font-medium">Archivo</th>
              <th className="px-3 py-3 text-left text-dark-300 font-medium hidden md:table-cell">Titulo</th>
              <th className="px-3 py-3 text-left text-dark-300 font-medium hidden sm:table-cell">Tipo</th>
              <th className="px-3 py-3 text-left text-dark-300 font-medium hidden lg:table-cell">Resolucion</th>
              <th className="px-3 py-3 text-left text-dark-300 font-medium hidden lg:table-cell">Codec</th>
              <th className="px-3 py-3 text-left text-dark-300 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-dark-400">
                  Cargando...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-dark-400">
                  No hay resultados
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-dark-700/50 hover:bg-dark-800/30 cursor-pointer transition-colors"
                  onClick={() => openEdit(item)}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {item.import_status === "pending" && (
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 rounded border-dark-600 bg-dark-700 text-primary-600"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {item.tmdb_poster_url ? (
                      <img
                        src={item.tmdb_poster_url}
                        alt=""
                        className="w-8 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-8 h-12 bg-dark-700 rounded flex items-center justify-center">
                        {item.media_type === "series" ? <Tv size={14} className="text-dark-500" /> : <Film size={14} className="text-dark-500" />}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-dark-200 text-xs truncate max-w-[200px]" title={item.file_name}>
                      {item.file_name}
                    </p>
                    <p className="text-dark-500 text-xs">
                      {formatBytes(item.file_size)} · {formatDuration(item.duration)}
                    </p>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <p className="text-dark-200 text-sm">
                      {item.tmdb_title || item.parsed_title || "—"}
                    </p>
                    {item.parsed_year > 0 && (
                      <p className="text-dark-500 text-xs">{item.tmdb_year || item.parsed_year}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.media_type === "series"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-purple-500/20 text-purple-400"
                    }`}>
                      {item.media_type === "series" ? <Tv size={10} /> : <Film size={10} />}
                      {item.media_type === "series"
                        ? `S${String(item.season_number).padStart(2, "0")}E${String(item.episode_number).padStart(2, "0")}`
                        : "Pelicula"
                      }
                    </span>
                  </td>
                  <td className="px-3 py-2 text-dark-300 text-xs hidden lg:table-cell">
                    {item.resolution || "—"}
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      !item.needs_transcode
                        ? "bg-green-500/20 text-green-400"
                        : "bg-orange-500/20 text-orange-400"
                    }`}>
                      {!item.needs_transcode ? "Directo" : "Transcodificar"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.import_status === "imported"
                        ? "bg-green-500/20 text-green-400"
                        : item.import_status === "failed"
                        ? "bg-red-500/20 text-red-400"
                        : item.import_status === "skipped"
                        ? "bg-dark-600 text-dark-400"
                        : "bg-dark-700 text-dark-300"
                    }`}>
                      {item.import_status === "imported" ? "Importado" : item.import_status === "failed" ? "Error" : item.import_status === "skipped" ? "Omitido" : "Pendiente"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Item"
        size="lg"
      >
        {editItem && (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
            <div className="flex gap-4">
              {editItem.tmdb_poster_url ? (
                <img src={editItem.tmdb_poster_url} alt="" className="w-24 h-36 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-24 h-36 bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Film size={32} className="text-dark-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-dark-500 truncate mb-1">{editItem.file_name}</p>
                <p className="text-xs text-dark-500">
                  {formatBytes(editItem.file_size)} · {editItem.resolution} · {editItem.video_codec}/{editItem.audio_codec} · {editItem.container}
                </p>
                <p className="text-xs mt-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    !editItem.needs_transcode ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"
                  }`}>
                    {!editItem.needs_transcode ? "Reproduccion directa" : "Requiere transcodificacion"}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormInput
                label="Titulo"
                name="parsed_title"
                value={editItem.parsed_title}
                onChange={(e) => setEditItem({ ...editItem, parsed_title: e.target.value })}
              />
              <FormInput
                label="Ano"
                name="parsed_year"
                type="number"
                value={String(editItem.parsed_year || "")}
                onChange={(e) => setEditItem({ ...editItem, parsed_year: Number(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormSelect
                label="Tipo"
                name="media_type"
                value={editItem.media_type}
                onChange={(e) => setEditItem({ ...editItem, media_type: e.target.value as "movie" | "series" })}
                options={[
                  { value: "movie", label: "Pelicula" },
                  { value: "series", label: "Serie" },
                ]}
              />
              {editItem.media_type === "series" && (
                <>
                  <FormInput
                    label="Temporada"
                    name="season_number"
                    type="number"
                    value={String(editItem.season_number || "")}
                    onChange={(e) => setEditItem({ ...editItem, season_number: Number(e.target.value) })}
                  />
                  <FormInput
                    label="Episodio"
                    name="episode_number"
                    type="number"
                    value={String(editItem.episode_number || "")}
                    onChange={(e) => setEditItem({ ...editItem, episode_number: Number(e.target.value) })}
                  />
                </>
              )}
            </div>

            {editItem.tmdb_title && (
              <div className="rounded-lg bg-dark-800/50 p-3">
                <p className="text-xs font-medium text-dark-400 mb-1">TMDB</p>
                <p className="text-sm text-dark-200">{editItem.tmdb_title} ({editItem.tmdb_year})</p>
                {editItem.tmdb_rating > 0 && (
                  <p className="text-xs text-dark-400">Rating: {editItem.tmdb_rating.toFixed(1)}/10</p>
                )}
              </div>
            )}

            <button
              onClick={openTMDBSearch}
              className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm w-full justify-center"
            >
              <Search size={14} />
              Buscar en TMDB
            </button>

            <div className="flex items-center justify-end gap-3 border-t border-dark-700 pt-4">
              <button
                onClick={() => setEditModalOpen(false)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button onClick={handleEditSave} className="btn-primary px-4 py-2 text-sm">
                Guardar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* TMDB Search Modal */}
      <Modal
        isOpen={tmdbModalOpen}
        onClose={() => setTmdbModalOpen(false)}
        title="Buscar en TMDB"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <FormInput
                label="Buscar"
                name="tmdb_query"
                value={tmdbQuery}
                onChange={(e) => setTmdbQuery(e.target.value)}
                placeholder="Titulo..."
              />
            </div>
            <div className="w-24">
              <FormInput
                label="Ano"
                name="tmdb_year"
                value={tmdbYear}
                onChange={(e) => setTmdbYear(e.target.value)}
                placeholder="Ano"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FormSelect
              label="Tipo"
              name="tmdb_type"
              value={tmdbType}
              onChange={(e) => setTmdbType(e.target.value)}
              options={[
                { value: "movie", label: "Pelicula" },
                { value: "series", label: "Serie" },
              ]}
            />
            <button
              onClick={searchTMDB}
              disabled={tmdbSearching}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm mt-6"
            >
              <Search size={14} />
              {tmdbSearching ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {tmdbResults.length > 0 && (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {tmdbResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => applyTMDBResult(result)}
                  className="flex gap-3 p-3 rounded-lg bg-dark-800/50 hover:bg-dark-700/50 cursor-pointer transition-colors"
                >
                  {result.poster_url ? (
                    <img src={result.poster_url} alt="" className="w-12 h-18 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-18 bg-dark-700 rounded flex items-center justify-center">
                      <Film size={16} className="text-dark-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-200">{result.title}</p>
                    <p className="text-xs text-dark-400">{result.year} · {result.rating.toFixed(1)}/10</p>
                    <p className="text-xs text-dark-500 line-clamp-2 mt-1">{result.overview}</p>
                  </div>
                  <button className="self-center text-primary-400 hover:text-primary-300 flex-shrink-0">
                    <Check size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tmdbResults.length === 0 && !tmdbSearching && tmdbQuery && (
            <p className="text-center text-dark-500 text-sm py-4">Sin resultados</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
