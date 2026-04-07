"use client";

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import { Pencil, Trash2, Plus, Film, Upload, CheckCircle, Loader2, Sparkles, FileText } from "lucide-react";
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
import type { SeriesWithCount, Category, VOD } from "@/lib/types";
import { formatDurationTimer as formatDuration, isValidURL } from "@/lib/utils";

interface SeriesForm {
  title: string;
  description: string;
  category_id: string;
  year: string;
  rating: string;
  total_seasons: string;
  poster_url: string;
  backdrop_url: string;
  is_active: boolean;
}

interface EpisodeForm {
  title: string;
  description: string;
  season_number: string;
  episode_number: string;
  year: string;
  rating: string;
  poster_url: string;
}

const emptySeriesForm: SeriesForm = {
  title: "",
  description: "",
  category_id: "",
  year: "",
  rating: "",
  total_seasons: "",
  poster_url: "",
  backdrop_url: "",
  is_active: true,
};

const emptyEpisodeForm: EpisodeForm = {
  title: "",
  description: "",
  season_number: "1",
  episode_number: "1",
  year: "",
  rating: "",
  poster_url: "",
};


type EpUploadStep = "idle" | "selected" | "uploading" | "processing" | "done";

export default function SeriesPage() {
  const toast = useToast();

  const [data, setData] = useState<SeriesWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SeriesWithCount | null>(null);
  const [form, setForm] = useState<SeriesForm>(emptySeriesForm);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<SeriesWithCount | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  // TMDB bulk enrich
  const [enriching, setEnriching] = useState(false);

  // Episode management
  const [episodeModalOpen, setEpisodeModalOpen] = useState(false);
  const [managingSeries, setManagingSeries] = useState<SeriesWithCount | null>(null);
  const [episodes, setEpisodes] = useState<VOD[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // Episode upload
  const [epUploadOpen, setEpUploadOpen] = useState(false);
  const [epForm, setEpForm] = useState<EpisodeForm>(emptyEpisodeForm);
  const [epUploadStep, setEpUploadStep] = useState<EpUploadStep>("idle");
  const [epSelectedFile, setEpSelectedFile] = useState<File | null>(null);
  const [epUploadProgress, setEpUploadProgress] = useState(0);
  const [epProcessingProgress, setEpProcessingProgress] = useState(0);
  const epPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const epFileInputRef = useRef<HTMLInputElement>(null);

  const stopEpPolling = () => {
    if (epPollRef.current) {
      clearInterval(epPollRef.current);
      epPollRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopEpPolling();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getSeries(page, 20);
      setData(res.data.data || []);
      setTotalPages(res.data.meta.pages);
    } catch {
      toast.error("Error al cargar las series");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminAPI.getCategoriesByType("series");
      setCategories(res.data.data || []);
    } catch {
      toast.error("Error cargando categorías");
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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

  const handleEpChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEpForm((prev) => ({ ...prev, [name]: value }));
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptySeriesForm);
    setModalOpen(true);
  };

  const openEdit = (item: SeriesWithCount) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description || "",
      category_id: item.category_id ? String(item.category_id) : "",
      year: item.year ? String(item.year) : "",
      rating: item.rating ? String(item.rating) : "",
      total_seasons: item.total_seasons ? String(item.total_seasons) : "",
      poster_url: item.poster_url || "",
      backdrop_url: item.backdrop_url || "",
      is_active: item.is_active,
    });
    setModalOpen(true);
  };

  const openDelete = (item: SeriesWithCount) => {
    setDeletingItem(item);
    setDeleteConfirm(true);
  };

  const loadEpisodes = async (series: SeriesWithCount) => {
    setEpisodesLoading(true);
    try {
      const res = await adminAPI.getSeriesEpisodes(series.id);
      const eps = (res.data.data || []) as VOD[];
      eps.sort((a, b) => {
        if (a.season_number !== b.season_number) return a.season_number - b.season_number;
        return a.episode_number - b.episode_number;
      });
      setEpisodes(eps);
    } catch {
      toast.error("Error al cargar episodios");
    } finally {
      setEpisodesLoading(false);
    }
  };

  const openEpisodeManager = (series: SeriesWithCount) => {
    setManagingSeries(series);
    setEpisodeModalOpen(true);
    loadEpisodes(series);
  };

  const handleSubmit = async () => {
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
      rating: form.rating ? Number(form.rating) : 0,
      total_seasons: form.total_seasons ? Number(form.total_seasons) : 0,
      poster_url: form.poster_url || undefined,
      backdrop_url: form.backdrop_url || undefined,
      is_active: form.is_active,
    };

    try {
      if (editingItem) {
        await adminAPI.updateSeries(editingItem.id, payload);
        toast.success("Serie actualizada correctamente");
      } else {
        await adminAPI.createSeries(payload);
        toast.success("Serie creada correctamente");
      }
      setModalOpen(false);
      fetchData();
    } catch {
      toast.error("Error al guardar la serie");
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await adminAPI.deleteSeries(deletingItem.id);
      toast.success("Serie eliminada correctamente");
      setDeleteConfirm(false);
      setDeletingItem(null);
      fetchData();
    } catch {
      toast.error("Error al eliminar la serie");
    }
  };

  const resetEpUpload = () => {
    stopEpPolling();
    setEpUploadStep("idle");
    setEpSelectedFile(null);
    setEpUploadProgress(0);
    setEpProcessingProgress(0);
    setEpForm(emptyEpisodeForm);
    if (epFileInputRef.current) epFileInputRef.current.value = "";
  };

  const closeEpUpload = () => {
    resetEpUpload();
    setEpUploadOpen(false);
  };

  const handleEpFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEpSelectedFile(file);
    setEpUploadStep("selected");

    const titleFromFile = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_.\-]+/g, " ")
      .trim();
    setEpForm((prev) => ({ ...prev, title: prev.title || titleFromFile }));
  };

  const handleEpSubmit = async () => {
    if (!epSelectedFile || !managingSeries) return;
    if (!epForm.title.trim()) {
      toast.error("El titulo del episodio es obligatorio");
      return;
    }
    if (!epForm.season_number || !epForm.episode_number) {
      toast.error("Temporada y episodio son obligatorios");
      return;
    }

    setEpUploadStep("uploading");
    setEpUploadProgress(0);

    try {
      const res = await adminAPI.uploadMediaWithVOD(
        epSelectedFile,
        epForm.title.trim(),
        (pct) => setEpUploadProgress(pct),
        {
          series_id: managingSeries.id,
          season_number: Number(epForm.season_number),
          episode_number: Number(epForm.episode_number),
        }
      );

      const vodData = res.data?.data;

      // Check if the file needs transcoding
      if (vodData && (vodData.transcode_status === "processing" || vodData.transcode_status === "pending")) {
        setEpUploadStep("processing");
        setEpProcessingProgress(0);

        const vodId = vodData.id;
        epPollRef.current = setInterval(async () => {
          try {
            const pollRes = await adminAPI.getVOD(vodId);
            const v = pollRes.data.data;
            setEpProcessingProgress(v.transcode_progress);

            if (v.transcode_status === "completed") {
              stopEpPolling();
              setEpUploadStep("done");
              toast.success(`Episodio T${epForm.season_number}E${epForm.episode_number} listo`);
              loadEpisodes(managingSeries);
              fetchData();
              setTimeout(() => closeEpUpload(), 2000);
            } else if (v.transcode_status === "failed") {
              stopEpPolling();
              toast.error("Error en la transcodificación del episodio");
              setEpUploadStep("selected");
            }
          } catch {
            // ignore transient poll errors
          }
        }, 3000);
      } else {
        // File was browser-compatible — done immediately
        setEpUploadStep("done");
        toast.success(`Episodio T${epForm.season_number}E${epForm.episode_number} creado`);
        loadEpisodes(managingSeries);
        fetchData();
        setTimeout(() => closeEpUpload(), 1200);
      }
    } catch {
      toast.error("Error al subir el episodio");
      setEpUploadStep("selected");
    }
  };

  const handleDeleteEpisode = async (ep: VOD) => {
    try {
      await adminAPI.deleteVOD(ep.id);
      toast.success("Episodio eliminado");
      if (managingSeries) loadEpisodes(managingSeries);
      fetchData();
    } catch {
      toast.error("Error al eliminar el episodio");
    }
  };

  const handleBulkEnrich = async () => {
    setEnriching(true);
    try {
      const res = await adminAPI.enrichSeries();
      const r = res.data.data;
      toast.success(`TMDB: ${r.enriched} enriquecidas, ${r.skipped} omitidas, ${r.failed} fallidas`);
      fetchData();
    } catch {
      toast.error("Error al enriquecer series con TMDB");
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

  const columns = [
    { key: "title", label: "Titulo" },
    {
      key: "category",
      label: "Categoria",
      render: (item: SeriesWithCount) => item.category?.name || "—",
    },
    { key: "total_seasons", label: "Temporadas" },
    { key: "episodes_count", label: "Episodios" },
    { key: "year", label: "Ano" },
    {
      key: "is_active",
      label: "Estado",
      render: (item: SeriesWithCount) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            item.is_active
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {item.is_active ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Acciones",
      render: (item: SeriesWithCount) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEpisodeManager(item)}
            className="btn-secondary flex items-center gap-1.5 px-2 py-2 text-xs"
            title="Gestionar episodios"
          >
            <Film size={13} />
            Episodios
          </button>
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100">Series</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkEnrich}
            disabled={enriching}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
            title="Enriquecer series sin poster con datos de TMDB"
          >
            {enriching ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {enriching ? "Enriqueciendo..." : "TMDB Auto"}
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus size={16} />
            Crear Serie
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data} loading={loading} emptyMessage="No hay series disponibles" />

      <div className="mt-4">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Serie create/edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Editar Serie" : "Crear Serie"}
        size="lg"
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
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
              mediaType="series"
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
              label="Total Temporadas"
              name="total_seasons"
              type="number"
              value={form.total_seasons}
              onChange={handleChange}
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

          <div className="flex items-center justify-end gap-3 border-t border-dark-700 pt-4">
            <button
              onClick={() => setModalOpen(false)}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button onClick={handleSubmit} className="btn-primary px-4 py-2 text-sm">
              {editingItem ? "Actualizar" : "Crear"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Episode manager modal */}
      <Modal
        isOpen={episodeModalOpen}
        onClose={() => {
          stopEpPolling();
          closeEpUpload();
          setEpisodeModalOpen(false);
          setManagingSeries(null);
          setEpisodes([]);
        }}
        title={managingSeries ? `Episodios — ${managingSeries.title}` : "Episodios"}
        size="lg"
      >
        <div className="max-h-[75vh] overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-dark-400">
              {episodesLoading ? "Cargando..." : `${episodes.length} episodio(s)`}
            </span>
            <button
              onClick={() => {
                setEpForm(emptyEpisodeForm);
                resetEpUpload();
                setEpUploadOpen(true);
              }}
              className="btn-primary flex items-center gap-2 px-3 py-2 text-xs"
            >
              <Upload size={13} />
              Subir episodio
            </button>
          </div>

          {episodesLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-dark-400" />
            </div>
          ) : episodes.length === 0 ? (
            <div className="rounded-lg border border-dark-700 py-10 text-center text-sm text-dark-500">
              No hay episodios. Sube el primero con el botón de arriba.
            </div>
          ) : (
            <div className="space-y-2">
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center gap-3 rounded-lg border border-dark-700 bg-dark-800 px-4 py-3"
                >
                  <span className="min-w-[60px] text-xs font-semibold text-primary-400">
                    T{ep.season_number}E{ep.episode_number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-dark-200">{ep.title}</p>
                    <p className="text-xs text-dark-500">{formatDuration(ep.duration)}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ep.transcode_status === "completed"
                        ? "bg-green-500/20 text-green-400"
                        : ep.transcode_status === "processing"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-dark-500/20 text-dark-400"
                    }`}
                  >
                    {ep.transcode_status === "completed"
                      ? "Listo"
                      : ep.transcode_status === "processing"
                      ? `${ep.transcode_progress}%`
                      : ep.transcode_status}
                  </span>
                  <button
                    onClick={() => handleDeleteEpisode(ep)}
                    className="ml-1 rounded p-1.5 text-dark-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Eliminar episodio"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Episode upload modal */}
      <Modal
        isOpen={epUploadOpen}
        onClose={closeEpUpload}
        title="Subir episodio"
        size="md"
      >
        <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-2">
          {epUploadStep === "idle" && (
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-dark-600 p-8 text-center transition-colors hover:border-primary-500/60 hover:bg-primary-500/5"
              onClick={() => epFileInputRef.current?.click()}
            >
              <Upload size={32} className="text-dark-500" />
              <div>
                <p className="font-medium text-dark-200">Seleccionar archivo de video</p>
                <p className="mt-1 text-xs text-dark-500">MP4, MKV, AVI, WEBM, MOV, FLV, TS, M4V, WMV</p>
              </div>
              <input
                ref={epFileInputRef}
                type="file"
                accept="video/*,.mkv,.ts,.m4v,.wmv,.flv"
                className="hidden"
                onChange={handleEpFileSelected}
              />
            </div>
          )}

          {epUploadStep === "selected" && (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-primary-500/20 bg-primary-500/5 px-3 py-2.5">
                <FileText size={16} className="text-primary-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dark-200 truncate">{epSelectedFile?.name}</p>
                  <p className="text-xs text-dark-500">
                    {epSelectedFile ? `${(epSelectedFile.size / 1024 / 1024).toFixed(1)} MB` : ""}
                  </p>
                </div>
                <button
                  onClick={() => { setEpUploadStep("idle"); setEpSelectedFile(null); if (epFileInputRef.current) epFileInputRef.current.value = ""; }}
                  className="text-xs text-dark-400 hover:text-dark-200"
                >
                  Cambiar
                </button>
              </div>

              <FormInput
                label="Titulo del episodio"
                name="title"
                value={epForm.title}
                onChange={handleEpChange}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Temporada"
                  name="season_number"
                  type="number"
                  value={epForm.season_number}
                  onChange={handleEpChange}
                  required
                />
                <FormInput
                  label="Episodio"
                  name="episode_number"
                  type="number"
                  value={epForm.episode_number}
                  onChange={handleEpChange}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-dark-700 pt-4">
                <button onClick={closeEpUpload} className="btn-secondary px-4 py-2 text-sm">
                  Cancelar
                </button>
                <button onClick={handleEpSubmit} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                  <Upload size={14} />
                  Subir y crear episodio
                </button>
              </div>
            </>
          )}

          {epUploadStep === "uploading" && (
            <div className="rounded-xl border border-dark-700 bg-dark-800 p-5">
              <div className="mb-3 flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-primary-400" />
                <span className="font-medium text-dark-200">Subiendo archivo...</span>
                <span className="ml-auto text-sm font-semibold text-primary-400">{epUploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-dark-700">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-200"
                  style={{ width: `${epUploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {epUploadStep === "processing" && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
              <div className="mb-3 flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-yellow-400" />
                <span className="font-medium text-dark-200">Convirtiendo a MP4...</span>
                <span className="ml-auto text-sm font-semibold text-yellow-400">{epProcessingProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-dark-700">
                <div
                  className="h-full rounded-full bg-yellow-500 transition-all duration-500"
                  style={{ width: `${epProcessingProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-dark-500">
                El archivo no es compatible con navegadores y se está convirtiendo a MP4 (H.264). Puede tardar varios minutos.
              </p>
            </div>
          )}

          {epUploadStep === "done" && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 p-8">
              <CheckCircle size={32} className="text-green-400" />
              <p className="font-medium text-green-400">Episodio creado correctamente</p>
              <p className="text-xs text-dark-500">El episodio ya está disponible para reproducir.</p>
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
        title="Eliminar Serie"
        message={`¿Estas seguro de que deseas eliminar "${deletingItem?.title}"? Esta accion no se puede deshacer.`}
      />
    </div>
  );
}
