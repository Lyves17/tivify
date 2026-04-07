"use client";

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import { Pencil, Trash2, Plus, Upload, CheckCircle, Loader2, Bug, ChevronDown, ChevronUp, Sparkles, HardDrive, RefreshCw, XCircle, AlertTriangle, FileText } from "lucide-react";
import axios from "axios";
import DataTable from "@/components/ui/data-table";
import Pagination from "@/components/ui/pagination";
import Modal from "@/components/ui/modal";
import FormInput from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import TMDBSearchButton from "@/components/ui/tmdb-search";
import type { TMDBSelection } from "@/components/ui/tmdb-search";
import { adminAPI } from "@/lib/api";
import { useToast } from "@/context/toast-context";
import type { VOD, Category, VODDebugStats, UploadDiagnostics } from "@/lib/types";
import { formatDurationTimer as formatDuration, isValidURL } from "@/lib/utils";

interface VODForm {
  title: string;
  description: string;
  category_id: string;
  year: string;
  duration: string;
  rating: string;
  poster_url: string;
  backdrop_url: string;
  hls_path: string;
  resolution: string;
  is_active: boolean;
  series_id: string;
  season_number: string;
  episode_number: string;
}

const emptyForm: VODForm = {
  title: "",
  description: "",
  category_id: "",
  year: "",
  duration: "",
  rating: "",
  poster_url: "",
  backdrop_url: "",
  hls_path: "",
  resolution: "",
  is_active: true,
  series_id: "",
  season_number: "",
  episode_number: "",
};

const resolutionOptions = [
  { value: "480p", label: "480p" },
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "4K", label: "4K" },
];


type UploadStep = "idle" | "selected" | "uploading" | "processing" | "done";
type CreateTab = "manual" | "upload";

export default function VODPage() {
  const toast = useToast();

  const [data, setData] = useState<VOD[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VOD | null>(null);
  const [form, setForm] = useState<VODForm>(emptyForm);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<VOD | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  // Debug stats
  const [debugStats, setDebugStats] = useState<VODDebugStats | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  // TMDB bulk enrich
  const [enriching, setEnriching] = useState(false);

  // Upload diagnostics
  const [uploadDiag, setUploadDiag] = useState<UploadDiagnostics | null>(null);
  const [uploadDiagOpen, setUploadDiagOpen] = useState(false);
  const [uploadDiagLoading, setUploadDiagLoading] = useState(false);

  const fetchUploadDiag = useCallback(async () => {
    setUploadDiagLoading(true);
    try {
      const res = await adminAPI.getUploadDiagnostics();
      setUploadDiag(res.data.data);
    } catch {
      toast.error("Error al cargar diagnóstico de uploads");
    } finally {
      setUploadDiagLoading(false);
    }
  }, [toast]);

  const fetchDebugStats = useCallback(async () => {
    try {
      const res = await adminAPI.getVODDebugStats();
      setDebugStats(res.data.data);
    } catch {
      /* ignore */
    }
  }, []);

  // Upload state
  const [createTab, setCreateTab] = useState<CreateTab>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadLogs, setUploadLogs] = useState<string[]>([]);
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setUploadLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getVODs(page, 20);
      setData(res.data.data || []);
      setTotalPages(res.data.meta.pages);
    } catch {
      toast.error("Error al cargar los VODs");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminAPI.getCategoriesByType("vod");
      setCategories(res.data.data || []);
    } catch {
      toast.error("Error cargando categorías");
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    fetchDebugStats();
  }, [fetchData, fetchDebugStats]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const categoryOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const resetUploadState = () => {
    setCreateTab("upload");
    setUploadStep("idle");
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadError(null);
    setUploadLogs([]);
    setTranscodeProgress(0);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    setModalOpen(false);
    resetUploadState();
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    resetUploadState();
    setModalOpen(true);
  };

  const openEdit = (item: VOD) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description || "",
      category_id: item.category_id ? String(item.category_id) : "",
      year: item.year ? String(item.year) : "",
      duration: item.duration ? String(item.duration) : "",
      rating: item.rating ? String(item.rating) : "",
      poster_url: item.poster_url || "",
      backdrop_url: item.backdrop_url || "",
      hls_path: item.hls_path || "",
      resolution: item.resolution || "",
      is_active: item.is_active,
      series_id: item.series_id ? String(item.series_id) : "",
      season_number: item.season_number ? String(item.season_number) : "",
      episode_number: item.episode_number ? String(item.episode_number) : "",
    });
    resetUploadState();
    setModalOpen(true);
  };

  const openDelete = (item: VOD) => {
    setDeletingItem(item);
    setDeleteConfirm(true);
  };

  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadStep("selected");

    const titleFromFile = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_.\-]+/g, " ")
      .trim();
    setForm((prev) => ({ ...prev, title: prev.title || titleFromFile }));
  };

  const handleUploadAndCreateVOD = async () => {
    if (!selectedFile) return;

    setUploadStep("uploading");
    setUploadProgress(0);
    setUploadError(null);
    setUploadLogs([]);

    const fileMB = (selectedFile.size / 1024 / 1024).toFixed(1);
    addLog(`Iniciando upload: ${selectedFile.name} (${fileMB} MB)`);
    addLog(`Titulo: "${form.title.trim() || "(auto desde nombre)"}"`);
    addLog(`Endpoint: POST /api/v1/admin/media/upload-vod`);

    try {
      const res = await adminAPI.uploadMediaWithVOD(selectedFile, form.title.trim(), (pct) => {
        setUploadProgress(pct);
        if (pct === 100) addLog("Upload 100% — esperando respuesta del servidor...");
      });

      addLog(`Respuesta: status=${res.status} success=${res.data?.success}`);
      const vodData = res.data?.data;
      if (vodData) {
        addLog(`VOD creado: id=${vodData.id} title="${vodData.title}" transcode_status="${vodData.transcode_status}" hls_path="${vodData.hls_path}"`);
      }

      // Check if the file needs transcoding
      if (vodData && (vodData.transcode_status === "processing" || vodData.transcode_status === "pending")) {
        addLog("Archivo requiere transcodificación a MP4 — iniciando seguimiento...");
        setUploadStep("processing");
        setTranscodeProgress(0);
        fetchData();

        // Poll for transcode progress every 3 seconds
        const vodId = vodData.id;
        pollRef.current = setInterval(async () => {
          try {
            const pollRes = await adminAPI.getVOD(vodId);
            const v = pollRes.data.data;
            setTranscodeProgress(v.transcode_progress);

            if (v.transcode_status === "completed") {
              addLog(`Transcodificación completada: hls_path="${v.hls_path}"`);
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
              setUploadStep("done");
              toast.success("VOD listo para reproducir");
              fetchData();
              fetchDebugStats();
              setTimeout(() => handleClose(), 2000);
            } else if (v.transcode_status === "failed") {
              addLog("ERROR: Transcodificación fallida");
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
              setUploadError("La transcodificación del archivo falló");
              toast.error("Error en la transcodificación");
              setUploadStep("selected");
              fetchData();
            }
          } catch {
            addLog("WARN: Error al consultar progreso de transcodificación");
          }
        }, 3000);
      } else {
        // File was browser-compatible — done immediately
        setUploadStep("done");
        toast.success("VOD creado correctamente");
        fetchData();
        fetchDebugStats();
        setTimeout(() => handleClose(), 1200);
      }
    } catch (err: unknown) {
      let errorMsg = "Error desconocido";
      let details = "";

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const respData = err.response?.data;
        const respMsg = typeof respData === "object" && respData !== null
          ? (respData as Record<string, unknown>).message || (respData as Record<string, unknown>).error || JSON.stringify(respData)
          : String(respData || "");

        if (status === 413) {
          errorMsg = `Archivo demasiado grande (${fileMB} MB). Limite del servidor excedido.`;
        } else if (status) {
          errorMsg = `HTTP ${status}: ${respMsg}`;
        } else if (err.code === "ECONNABORTED") {
          errorMsg = `Timeout: el servidor tardó demasiado (${selectedFile.name}: ${fileMB} MB)`;
        } else if (err.code === "ERR_NETWORK") {
          errorMsg = "Error de red: no se pudo conectar al servidor";
        } else {
          errorMsg = err.message || "Error de conexión";
        }

        details = [
          `status: ${status || "N/A"}`,
          `code: ${err.code || "N/A"}`,
          `message: ${err.message}`,
          `response: ${typeof respData === "string" ? respData.slice(0, 500) : JSON.stringify(respData)?.slice(0, 500)}`,
        ].join("\n");
      } else if (err instanceof Error) {
        errorMsg = err.message;
        details = err.stack || "";
      }

      addLog(`ERROR: ${errorMsg}`);
      if (details) addLog(`Detalles: ${details}`);

      setUploadError(errorMsg);
      toast.error(errorMsg);
      setUploadStep("selected");
    }
  };

  const handleSubmitManual = async () => {
    if (!form.title.trim()) {
      toast.error("El título es requerido");
      return;
    }
    if (form.title.length > 200) {
      toast.error("El título no puede exceder 200 caracteres");
      return;
    }

    const payload = {
      title: form.title,
      description: form.description || undefined,
      category_id: form.category_id ? Number(form.category_id) : undefined,
      year: form.year ? Number(form.year) : 0,
      duration: form.duration ? Number(form.duration) : 0,
      rating: form.rating ? Number(form.rating) : 0,
      poster_url: form.poster_url || undefined,
      backdrop_url: form.backdrop_url || undefined,
      hls_path: form.hls_path || undefined,
      resolution: form.resolution || undefined,
      is_active: form.is_active,
      series_id: form.series_id ? Number(form.series_id) : undefined,
      season_number: form.season_number ? Number(form.season_number) : 0,
      episode_number: form.episode_number ? Number(form.episode_number) : 0,
    };

    try {
      if (editingItem) {
        await adminAPI.updateVOD(editingItem.id, payload);
        toast.success("VOD actualizado correctamente");
      } else {
        await adminAPI.createVOD(payload);
        toast.success("VOD creado correctamente");
      }
      handleClose();
      fetchData();
      fetchDebugStats();
    } catch {
      toast.error("Error al guardar el VOD");
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await adminAPI.deleteVOD(deletingItem.id);
      toast.success("VOD eliminado correctamente");
      setDeleteConfirm(false);
      setDeletingItem(null);
      fetchData();
      fetchDebugStats();
    } catch {
      toast.error("Error al eliminar el VOD");
    }
  };

  const columns = [
    { key: "title", label: "Titulo" },
    {
      key: "category",
      label: "Categoria",
      render: (item: VOD) => item.category?.name || "—",
    },
    {
      key: "duration",
      label: "Duracion",
      render: (item: VOD) => formatDuration(item.duration),
    },
    { key: "year", label: "Ano" },
    {
      key: "transcode_status",
      label: "Estado",
      render: (item: VOD) => {
        const statusMap: Record<string, { label: string; cls: string }> = {
          completed: { label: "Listo", cls: "bg-green-500/20 text-green-400" },
          processing: { label: "Procesando", cls: "bg-yellow-500/20 text-yellow-400" },
          pending: { label: "Pendiente", cls: "bg-dark-500/20 text-dark-400" },
          failed: { label: "Error", cls: "bg-red-500/20 text-red-400" },
        };
        const s = statusMap[item.transcode_status] || statusMap.pending;
        return (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
            {s.label}
            {item.transcode_status === "processing" && ` ${item.transcode_progress}%`}
          </span>
        );
      },
    },
    {
      key: "is_active",
      label: "Activo",
      render: (item: VOD) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            item.is_active
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {item.is_active ? "Si" : "No"}
        </span>
      ),
    },
    {
      key: "visible",
      label: "Visible",
      render: (item: VOD) => {
        const visible = item.is_active && !item.series_id;
        return (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              visible
                ? "bg-primary-500/20 text-primary-400"
                : "bg-dark-600/40 text-dark-500"
            }`}
          >
            {visible ? "Sí" : "No"}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Acciones",
      render: (item: VOD) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(item)}
            className="btn-secondary p-2 text-sm"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => openDelete(item)}
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400 transition-colors hover:bg-red-500/20"
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const handleBulkEnrich = async () => {
    setEnriching(true);
    try {
      const res = await adminAPI.enrichVODs();
      const r = res.data.data;
      toast.success(`TMDB: ${r.enriched} enriquecidos, ${r.skipped} omitidos, ${r.failed} fallidos`);
      fetchData();
    } catch {
      toast.error("Error al enriquecer VODs con TMDB");
    } finally {
      setEnriching(false);
    }
  };

  const handleTMDBSelect = (r: TMDBSelection) => {
    setForm((prev) => ({
      ...prev,
      title: r.title || prev.title,
      description: r.description || prev.description,
      year: r.year ? String(r.year) : prev.year,
      rating: r.rating ? String(r.rating) : prev.rating,
      poster_url: r.poster_url || prev.poster_url,
      backdrop_url: r.backdrop_url || prev.backdrop_url,
    }));
    toast.success("Metadatos TMDB aplicados");
  };

  const renderMetadataForm = () => (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <FormInput
            label="Titulo"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />
        </div>
        <TMDBSearchButton
          initialQuery={form.title}
          mediaType="movie"
          onSelect={handleTMDBSelect}
          className="mb-0.5"
        />
      </div>
      <FormTextarea
        label="Descripcion"
        name="description"
        value={form.description}
        onChange={handleChange}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormSelect
          label="Categoria"
          name="category_id"
          value={form.category_id}
          onChange={handleChange}
          options={categoryOptions}
        />
        <FormInput
          label="Ano"
          name="year"
          type="number"
          value={form.year}
          onChange={handleChange}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          label="Rating (0-10)"
          name="rating"
          type="number"
          value={form.rating}
          onChange={handleChange}
        />
        <FormInput
          label="Duracion (segundos)"
          name="duration"
          type="number"
          value={form.duration}
          onChange={handleChange}
          disabled={false}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          label="Poster URL"
          name="poster_url"
          value={form.poster_url}
          onChange={handleChange}
        />
        <FormInput
          label="Backdrop URL"
          name="backdrop_url"
          value={form.backdrop_url}
          onChange={handleChange}
        />
      </div>
      {/* HLS path: editable in manual/advanced mode, read-only when editing */}
      {createTab === "manual" && !editingItem && (
        <FormInput
          label="Ruta HLS (para contenido externo)"
          name="hls_path"
          value={form.hls_path}
          onChange={handleChange}
          placeholder="/media/vod/ejemplo/index.m3u8"
        />
      )}
      {editingItem && form.hls_path && (
        <div className="rounded-lg bg-dark-800 border border-dark-700 px-3 py-2">
          <p className="text-xs text-dark-500 mb-1">Ruta HLS (generada automáticamente)</p>
          <p className="text-xs font-mono text-dark-300 break-all">{form.hls_path}</p>
        </div>
      )}
      {/* Resolution info */}
      {form.resolution && (
        <div className="rounded-lg bg-dark-800 px-3 py-2 text-sm">
          <span className="text-dark-400">Resolución: </span>
          <span className="font-medium text-dark-200">{form.resolution}</span>
        </div>
      )}
      {/* Advanced tab hint: explain that HLS comes from upload */}
      {createTab === "manual" && !editingItem && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
          <p className="text-xs text-dark-400">
            Modo avanzado: crea un VOD manualmente con HLS path externo. Para subir un archivo y generar
            el VOD automáticamente, usa la pestaña{" "}
            <span className="text-primary-400 font-medium">"Subir archivo"</span>.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          name="is_active"
          checked={form.is_active}
          onChange={handleChange}
          className="h-4 w-4 rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="is_active" className="text-sm font-medium text-dark-200">
          Activo
        </label>
      </div>

      <div className="border-t border-dark-700 pt-4">
        <p className="mb-3 text-sm font-medium text-dark-300">
          Episodio (opcional — solo si pertenece a una serie)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormInput
            label="Series ID"
            name="series_id"
            type="number"
            value={form.series_id}
            onChange={handleChange}
          />
          <FormInput
            label="Temporada"
            name="season_number"
            type="number"
            value={form.season_number}
            onChange={handleChange}
          />
          <FormInput
            label="Episodio"
            name="episode_number"
            type="number"
            value={form.episode_number}
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100">VODs</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkEnrich}
            disabled={enriching}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
            title="Enriquecer VODs sin poster con datos de TMDB"
          >
            {enriching ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {enriching ? "Enriqueciendo..." : "TMDB Auto"}
          </button>
          <button
            onClick={() => { if (!uploadDiagOpen) fetchUploadDiag(); setUploadDiagOpen((v) => !v); }}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
            title="Diagnóstico de uploads y transcodificación"
          >
            <HardDrive size={16} />
            Upload Debug
            {uploadDiagOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => { fetchDebugStats(); setDebugOpen((v) => !v); }}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
            title="Panel de diagnóstico de visibilidad"
          >
            <Bug size={16} />
            {debugStats ? `Debug (${debugStats.visible_to_users} visibles)` : "Debug"}
            {debugOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus size={16} />
            Crear VOD
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data} loading={loading} emptyMessage="No hay VODs disponibles" />

      <div className="mt-4">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Debug panel */}
      {debugOpen && debugStats && (
        <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <h3 className="mb-4 text-sm font-semibold text-yellow-400 flex items-center gap-2">
            <Bug size={14} />
            Diagnóstico de visibilidad VODs
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="rounded-lg bg-dark-800 border border-dark-700 p-3 text-center">
              <p className="text-2xl font-bold text-dark-100">{debugStats.total}</p>
              <p className="text-xs text-dark-400 mt-1">Total VODs</p>
            </div>
            <div className="rounded-lg bg-dark-800 border border-primary-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-primary-400">{debugStats.visible_to_users}</p>
              <p className="text-xs text-dark-400 mt-1">Visibles a usuarios</p>
            </div>
            <div className="rounded-lg bg-dark-800 border border-blue-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{debugStats.active_episodes}</p>
              <p className="text-xs text-dark-400 mt-1">Episodios activos</p>
            </div>
            <div className="rounded-lg bg-dark-800 border border-red-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{debugStats.inactive}</p>
              <p className="text-xs text-dark-400 mt-1">Inactivos</p>
            </div>
          </div>

          {debugStats.problems && debugStats.problems.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-400">
                VODs con problemas de visibilidad ({debugStats.problems.length})
              </p>
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {debugStats.problems.map((p) => {
                  const vodItem = data.find((v) => v.id === p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 rounded-lg bg-dark-800/80 border border-dark-700 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-dark-200">{p.title}</p>
                        <p className="mt-0.5 text-xs text-yellow-400/80">{p.reason}</p>
                        {p.hls_path && (
                          <p className="mt-0.5 font-mono text-xs text-dark-500 truncate">{p.hls_path}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-dark-500">ID {p.id}</span>
                        {vodItem && (
                          <button
                            onClick={() => openEdit(vodItem)}
                            className="rounded px-2 py-0.5 text-xs bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors"
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-green-400 flex items-center gap-2">
              <CheckCircle size={14} />
              Todos los VODs activos independientes están visibles para los usuarios.
            </p>
          )}
        </div>
      )}

      {/* Upload Diagnostics Panel */}
      {uploadDiagOpen && (
        <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
              <HardDrive size={14} />
              Diagnóstico de Uploads y Transcodificación
            </h3>
            <button
              onClick={fetchUploadDiag}
              disabled={uploadDiagLoading}
              className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <RefreshCw size={12} className={uploadDiagLoading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>

          {uploadDiagLoading && !uploadDiag ? (
            <div className="flex items-center justify-center py-8 gap-2 text-dark-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Cargando diagnóstico...</span>
            </div>
          ) : uploadDiag ? (
            <div className="space-y-5">
              {/* System Info */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-400">Sistema</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-dark-800 border border-dark-700 p-3">
                    <p className="text-xs text-dark-500 mb-1">Usuario</p>
                    <p className="text-sm font-mono text-dark-200">{uploadDiag.current_user}</p>
                    <p className="text-xs text-dark-500">UID: {uploadDiag.current_uid}</p>
                  </div>
                  <div className={`rounded-lg bg-dark-800 border p-3 ${uploadDiag.ffmpeg_ok ? "border-green-500/20" : "border-red-500/30"}`}>
                    <p className="text-xs text-dark-500 mb-1">FFmpeg</p>
                    <div className="flex items-center gap-1.5">
                      {uploadDiag.ffmpeg_ok ? <CheckCircle size={12} className="text-green-400" /> : <XCircle size={12} className="text-red-400" />}
                      <span className={`text-xs font-medium ${uploadDiag.ffmpeg_ok ? "text-green-400" : "text-red-400"}`}>
                        {uploadDiag.ffmpeg_ok ? "OK" : "No encontrado"}
                      </span>
                    </div>
                    {uploadDiag.ffmpeg_version && <p className="text-xs text-dark-500 mt-1 truncate">{uploadDiag.ffmpeg_version}</p>}
                  </div>
                  <div className={`rounded-lg bg-dark-800 border p-3 ${uploadDiag.ffprobe_ok ? "border-green-500/20" : "border-red-500/30"}`}>
                    <p className="text-xs text-dark-500 mb-1">FFprobe</p>
                    <div className="flex items-center gap-1.5">
                      {uploadDiag.ffprobe_ok ? <CheckCircle size={12} className="text-green-400" /> : <XCircle size={12} className="text-red-400" />}
                      <span className={`text-xs font-medium ${uploadDiag.ffprobe_ok ? "text-green-400" : "text-red-400"}`}>
                        {uploadDiag.ffprobe_ok ? "OK" : "No encontrado"}
                      </span>
                    </div>
                    {uploadDiag.ffprobe_version && <p className="text-xs text-dark-500 mt-1 truncate">{uploadDiag.ffprobe_version}</p>}
                  </div>
                  <div className="rounded-lg bg-dark-800 border border-dark-700 p-3">
                    <p className="text-xs text-dark-500 mb-1">Disco</p>
                    <p className="text-sm font-semibold text-dark-200">{uploadDiag.disk_free_gb.toFixed(1)} GB libres</p>
                    <p className="text-xs text-dark-500">de {uploadDiag.disk_total_gb.toFixed(1)} GB</p>
                  </div>
                </div>
              </div>

              {/* Directories */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-400">
                  Directorios ({uploadDiag.media_path})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {uploadDiag.directories.map((dir) => (
                    <div
                      key={dir.path}
                      className={`flex items-center gap-2 rounded-lg bg-dark-800 border px-3 py-2 ${
                        dir.exists && dir.writable ? "border-green-500/20" : "border-red-500/30"
                      }`}
                    >
                      {dir.exists && dir.writable ? (
                        <CheckCircle size={14} className="text-green-400 shrink-0" />
                      ) : !dir.exists ? (
                        <XCircle size={14} className="text-red-400 shrink-0" />
                      ) : (
                        <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-dark-300 truncate">{dir.path}</p>
                        <p className="text-xs text-dark-500">
                          {!dir.exists ? "No existe" : dir.writable ? "OK" : "Sin permiso de escritura"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status counts */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-400">
                  LocalMedia por estado
                </p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg bg-dark-800 border border-dark-700 p-3 text-center">
                    <p className="text-xl font-bold text-yellow-400">{uploadDiag.pending_count}</p>
                    <p className="text-xs text-dark-400">Pendiente</p>
                  </div>
                  <div className="rounded-lg bg-dark-800 border border-dark-700 p-3 text-center">
                    <p className="text-xl font-bold text-blue-400">{uploadDiag.processing_count}</p>
                    <p className="text-xs text-dark-400">Procesando</p>
                  </div>
                  <div className="rounded-lg bg-dark-800 border border-dark-700 p-3 text-center">
                    <p className="text-xl font-bold text-green-400">{uploadDiag.completed_count}</p>
                    <p className="text-xs text-dark-400">Completado</p>
                  </div>
                  <div className="rounded-lg bg-dark-800 border border-dark-700 p-3 text-center">
                    <p className="text-xl font-bold text-red-400">{uploadDiag.failed_count}</p>
                    <p className="text-xs text-dark-400">Fallido</p>
                  </div>
                </div>
              </div>

              {/* Recent media entries */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-400">
                  Últimos archivos subidos (LocalMedia)
                </p>
                {uploadDiag.recent_media && uploadDiag.recent_media.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {uploadDiag.recent_media.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-lg bg-dark-800 border px-3 py-2.5 ${
                          m.status === "completed" && m.file_exists && m.hls_exists
                            ? "border-green-500/20"
                            : m.status === "failed"
                            ? "border-red-500/30"
                            : "border-yellow-500/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-dark-200 truncate">
                              {m.original_filename}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-dark-500">
                              <span>ID: {m.id}</span>
                              <span>{(m.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                              {m.duration > 0 && <span>{Math.floor(m.duration / 60)}:{String(Math.round(m.duration % 60)).padStart(2, "0")}</span>}
                              {m.resolution && <span>{m.resolution}</span>}
                              <span>{new Date(m.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                              m.status === "completed"
                                ? "bg-green-500/20 text-green-400"
                                : m.status === "processing"
                                ? "bg-blue-500/20 text-blue-400"
                                : m.status === "failed"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            {m.status} {m.status === "processing" && `${m.progress}%`}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            {m.file_exists ? (
                              <CheckCircle size={11} className="text-green-400 shrink-0" />
                            ) : (
                              <XCircle size={11} className="text-red-400 shrink-0" />
                            )}
                            <span className="text-dark-500">Archivo:</span>
                            <span className="font-mono text-dark-400 truncate">{m.file_path || "—"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {m.hls_exists ? (
                              <CheckCircle size={11} className="text-green-400 shrink-0" />
                            ) : (
                              <XCircle size={11} className="text-red-400 shrink-0" />
                            )}
                            <span className="text-dark-500">HLS:</span>
                            <span className="font-mono text-dark-400 truncate">{m.hls_path || "—"}</span>
                          </div>
                        </div>

                        {m.error_message && (
                          <div className="mt-1.5 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">
                            {m.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-dark-500 py-4 text-center">No hay archivos subidos aún.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={handleClose}
        title={editingItem ? "Editar VOD" : "Crear VOD"}
        size="lg"
      >
        <div className="max-h-[75vh] overflow-y-auto pr-2">
          {/* Tab switcher — only when creating */}
          {!editingItem && (
            <div className="mb-4 flex rounded-lg bg-dark-800 p-1">
              <button
                onClick={() => setCreateTab("upload")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                  createTab === "upload"
                    ? "bg-dark-700 text-dark-100"
                    : "text-dark-400 hover:text-dark-200"
                }`}
              >
                <Upload size={14} />
                Subir archivo
              </button>
              <button
                onClick={() => { setCreateTab("manual"); setUploadStep("idle"); setSelectedFile(null); }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  createTab === "manual"
                    ? "bg-dark-700 text-dark-100"
                    : "text-dark-400 hover:text-dark-200"
                }`}
              >
                Avanzado
              </button>
            </div>
          )}

          {/* Upload flow */}
          {createTab === "upload" && !editingItem && (
            <div className="space-y-4">
              {uploadStep === "idle" && (
                <div
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-dark-600 p-10 text-center transition-colors hover:border-primary-500/60 hover:bg-primary-500/5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={36} className="text-dark-500" />
                  <div>
                    <p className="font-medium text-dark-200">Haz clic para seleccionar un archivo</p>
                    <p className="mt-1 text-xs text-dark-500">MP4, MKV, AVI, WEBM, MOV, FLV, TS, M4V, WMV</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,.mkv,.ts,.m4v,.wmv,.flv"
                    className="hidden"
                    onChange={handleFileSelected}
                  />
                </div>
              )}

              {uploadStep === "selected" && (
                <>
                  <div className="flex items-center gap-3 rounded-lg border border-primary-500/20 bg-primary-500/5 px-3 py-2.5">
                    <Upload size={16} className="text-primary-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-dark-200 truncate">{selectedFile?.name}</p>
                      <p className="text-xs text-dark-500">
                        {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => { setUploadStep("idle"); setSelectedFile(null); setUploadError(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-xs text-dark-400 hover:text-dark-200"
                    >
                      Cambiar
                    </button>
                  </div>

                  {/* Error message from last attempt */}
                  {uploadError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-red-400">Error en la subida</p>
                          <p className="text-xs text-red-300/80 mt-1 break-all">{uploadError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <FormInput
                    label="Titulo"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Se genera del nombre del archivo si se deja vacío"
                  />
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button onClick={handleClose} className="btn-secondary px-4 py-2 text-sm">
                      Cancelar
                    </button>
                    <button onClick={handleUploadAndCreateVOD} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                      <Upload size={14} />
                      Subir
                    </button>
                  </div>
                </>
              )}

              {uploadStep === "uploading" && (
                <div className="rounded-xl border border-dark-700 bg-dark-800 p-6">
                  <div className="mb-3 flex items-center gap-3">
                    <Loader2 size={18} className="animate-spin text-primary-400" />
                    <span className="font-medium text-dark-200">Subiendo archivo...</span>
                    <span className="ml-auto text-sm font-semibold text-primary-400">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-dark-700">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadStep === "processing" && (
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
                  <div className="mb-3 flex items-center gap-3">
                    <Loader2 size={18} className="animate-spin text-yellow-400" />
                    <span className="font-medium text-dark-200">Transcodificando a MP4...</span>
                    <span className="ml-auto text-sm font-semibold text-yellow-400">{transcodeProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-dark-700">
                    <div
                      className="h-full rounded-full bg-yellow-500 transition-all duration-500"
                      style={{ width: `${transcodeProgress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-dark-500">
                    El archivo no es compatible con navegadores y se está convirtiendo a MP4 (H.264). Esto puede tardar unos minutos dependiendo del tamaño del archivo.
                  </p>
                </div>
              )}

              {uploadStep === "done" && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 p-8">
                  <CheckCircle size={36} className="text-green-400" />
                  <p className="font-medium text-green-400">VOD creado correctamente</p>
                  <p className="text-xs text-dark-500">El contenido ya está disponible para reproducir.</p>
                </div>
              )}

              {/* Debug logs panel */}
              {uploadLogs.length > 0 && (
                <div className="rounded-lg border border-dark-700 bg-dark-900 p-3 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-dark-400 flex items-center gap-1.5">
                      <FileText size={12} />
                      Log de subida
                    </p>
                    <button
                      onClick={() => setUploadLogs([])}
                      className="text-xs text-dark-500 hover:text-dark-300"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono text-xs">
                    {uploadLogs.map((log, i) => (
                      <p
                        key={i}
                        className={
                          log.includes("ERROR")
                            ? "text-red-400"
                            : log.includes("OK") || log.includes("VOD creado")
                            ? "text-green-400"
                            : "text-dark-400"
                        }
                      >
                        {log}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual form */}
          {(createTab === "manual" || editingItem) && (
            <div className="space-y-4">
              {renderMetadataForm()}
              <div className="flex items-center justify-end gap-3 border-t border-dark-700 pt-4">
                <button onClick={handleClose} className="btn-secondary px-4 py-2 text-sm">
                  Cancelar
                </button>
                <button onClick={handleSubmitManual} className="btn-primary px-4 py-2 text-sm">
                  {editingItem ? "Actualizar" : "Crear"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteConfirm(false);
          setDeletingItem(null);
        }}
        title="Eliminar VOD"
        message={`¿Estas seguro de que deseas eliminar "${deletingItem?.title}"? Esta accion no se puede deshacer.`}
      />
    </div>
  );
}
