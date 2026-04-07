"use client";

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import { adminAPI } from "@/lib/api";
import type { Category, Channel, ChannelList, Stream, LocalMedia, Playlist, PlaylistItem, EmissionStatus } from "@/lib/types";
import { useToast } from "@/context/toast-context";
import DataTable from "@/components/ui/data-table";
import Pagination from "@/components/ui/pagination";
import Modal from "@/components/ui/modal";
import FormInput from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import VideoPlayer from "@/components/ui/video-player";
import { formatDurationTimer as formatDuration, isValidURL } from "@/lib/utils";

const FORMAT_OPTIONS = [
  { value: "hls", label: "HLS" },
  { value: "rtmp", label: "RTMP" },
  { value: "mpegts", label: "MPEG-TS" },
];

const PLAYBACK_MODE_OPTIONS = [
  { value: "loop", label: "Bucle (Loop)" },
  { value: "once", label: "Una vez" },
  { value: "shuffle", label: "Aleatorio (Shuffle)" },
];

const ACCEPTED_EXTENSIONS = ".mp4,.mkv,.avi,.webm,.mov,.flv,.ts,.m4v,.wmv";

const EMPTY_CHANNEL_FORM = {
  name: "",
  category_id: "",
  logo_url: "",
  epg_channel_id: "",
  channel_number: "",
  is_active: true,
};

const EMPTY_STREAM_FORM = {
  url: "",
  stream_format: "hls" as "hls" | "rtmp" | "mpegts",
  priority: 0,
  is_active: true,
};

// Poll interval refs to prevent accumulation (F5: Fix polling intervals)
const intervalRefsMap = new Map<string, ReturnType<typeof setInterval>>();

function clearInterval_Safe(key: string) {
  if (intervalRefsMap.has(key)) {
    clearInterval(intervalRefsMap.get(key));
    intervalRefsMap.delete(key);
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}


export default function ChannelsPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Channel list state
  const [channels, setChannels] = useState<ChannelList[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Categories for the select
  const [categories, setCategories] = useState<Category[]>([]);

  // Channel modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [channelForm, setChannelForm] = useState(EMPTY_CHANNEL_FORM);
  const [saving, setSaving] = useState(false);

  // Streams inside the edit modal
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);

  // Stream add/edit inline form
  const [showStreamForm, setShowStreamForm] = useState(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [streamForm, setStreamForm] = useState(EMPTY_STREAM_FORM);
  const [savingStream, setSavingStream] = useState(false);

  // Delete channel confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ChannelList | null>(null);

  // Delete stream confirm
  const [deleteStreamConfirm, setDeleteStreamConfirm] = useState(false);
  const [deletingStream, setDeletingStream] = useState<Stream | null>(null);

  // --- Emisión Local state ---
  const [activeTab, setActiveTab] = useState<"streams" | "emision">("streams");
  const [mediaList, setMediaList] = useState<LocalMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [generatingStream, setGeneratingStream] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Stream preview + M3U download state ---
  const [previewStream, setPreviewStream] = useState<Stream | null>(null);
  const [selectedStreamIds, setSelectedStreamIds] = useState<Set<number>>(new Set());

  // --- Emission (live ffmpeg) state ---
  const [emissionStatus, setEmissionStatus] = useState<EmissionStatus | null>(null);
  const [emissionLoading, setEmissionLoading] = useState(false);
  const emissionPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getChannels(page, 20);
      setChannels(res.data.data || []);
      setTotalPages(res.data.meta.pages);
    } catch {
      toastRef.current.error("Error al cargar canales");
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminAPI.getCategoriesByType("live");
      setCategories(res.data.data || []);
    } catch {
      toastRef.current.error("Error cargando categorías");
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // --- Media Library ---
  const fetchMediaList = useCallback(async () => {
    try {
      setMediaLoading(true);
      const res = await adminAPI.getMediaList(1, 100);
      setMediaList(res.data.data || []);
    } catch {
      // silent
    } finally {
      setMediaLoading(false);
    }
  }, []);

  // --- Playlist ---
  const fetchPlaylist = useCallback(async (channelId: number) => {
    try {
      setPlaylistLoading(true);
      const res = await adminAPI.getChannelPlaylist(channelId);
      setPlaylist(res.data.data || null);
    } catch {
      setPlaylist(null);
    } finally {
      setPlaylistLoading(false);
    }
  }, []);

  // --- Polling for transcoding progress ---
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await adminAPI.getMediaList(1, 100);
        const list = res.data.data || [];
        setMediaList(list);
        // Stop polling if nothing is processing
        const hasProcessing = list.some(
          (m: LocalMedia) => m.status === "pending" || m.status === "processing"
        );
        if (!hasProcessing && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch {
        // silent
      }
    }, 3000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Stop polling when modal closes
  useEffect(() => {
    if (!modalOpen) {
      stopPolling();
    }
  }, [modalOpen, stopPolling]);

  // Start polling if there are processing items when we load
  useEffect(() => {
    const hasProcessing = mediaList.some(
      (m) => m.status === "pending" || m.status === "processing"
    );
    if (hasProcessing && activeTab === "emision") {
      startPolling();
    }
  }, [mediaList, activeTab, startPolling]);

  // Channel form handlers
  const handleChannelChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setChannelForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setChannelForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Stream form handlers
  const handleStreamChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setStreamForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setStreamForm((prev) => ({
        ...prev,
        [name]: name === "priority" ? Number(value) : value,
      }));
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setChannelForm(EMPTY_CHANNEL_FORM);
    setStreams([]);
    setShowStreamForm(false);
    setEditingStream(null);
    setActiveTab("streams");
    setSelectedStreamIds(new Set());
    setModalOpen(true);
  };

  const openEditModal = async (channelListItem: ChannelList) => {
    try {
      setLoadingStreams(true);
      setModalOpen(true);
      setActiveTab("streams");
      const res = await adminAPI.getChannel(channelListItem.id);
      const channel = res.data.data;
      setEditing(channel);
      setChannelForm({
        name: channel.name,
        category_id: channel.category_id ? String(channel.category_id) : "",
        logo_url: channel.logo_url || "",
        epg_channel_id: channel.epg_channel_id || "",
        channel_number: channel.channel_number ? String(channel.channel_number) : "",
        is_active: channel.is_active,
      });
      setStreams(channel.streams || []);
      setShowStreamForm(false);
      setEditingStream(null);
      setSelectedStreamIds(new Set());
      // Load media and playlist for emisión local
      fetchMediaList();
      fetchPlaylist(channel.id);
      // Load emission status
      fetchEmissionStatus(channel.id);
    } catch {
      toast.error("Error al cargar canal");
      setModalOpen(false);
    } finally {
      setLoadingStreams(false);
    }
  };

  const handleChannelSubmit = async () => {
    if (!channelForm.name.trim()) {
      toast.error("El nombre del canal es requerido");
      return;
    }
    if (channelForm.name.length > 200) {
      toast.error("El nombre no puede exceder 200 caracteres");
      return;
    }
    if (channelForm.logo_url && !isValidURL(channelForm.logo_url)) {
      toast.error("URL del logo no es válida");
      return;
    }

    const payload = {
      name: channelForm.name.trim(),
      category_id: channelForm.category_id ? Number(channelForm.category_id) : undefined,
      logo_url: channelForm.logo_url || undefined,
      epg_channel_id: channelForm.epg_channel_id || undefined,
      channel_number: channelForm.channel_number ? Number(channelForm.channel_number) : undefined,
      is_active: channelForm.is_active,
    };

    try {
      setSaving(true);
      if (editing) {
        await adminAPI.updateChannel(editing.id, payload);
        toast.success("Canal actualizado");
      } else {
        await adminAPI.createChannel(payload);
        toast.success("Canal creado");
      }
      setModalOpen(false);
      fetchChannels();
    } catch {
      toast.error(
        editing ? "Error al actualizar canal" : "Error al crear canal"
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete channel
  const openDeleteConfirm = (channel: ChannelList) => {
    setDeletingItem(channel);
    setDeleteConfirm(true);
  };

  const handleDeleteChannel = async () => {
    if (!deletingItem) return;
    try {
      await adminAPI.deleteChannel(deletingItem.id);
      toast.success("Canal eliminado");
      setDeleteConfirm(false);
      setDeletingItem(null);
      fetchChannels();
    } catch {
      toast.error("Error al eliminar canal");
    }
  };

  // Stream CRUD
  const openAddStream = () => {
    setEditingStream(null);
    setStreamForm(EMPTY_STREAM_FORM);
    setShowStreamForm(true);
  };

  const openEditStream = (stream: Stream) => {
    setEditingStream(stream);
    setStreamForm({
      url: stream.url,
      stream_format: stream.stream_format,
      priority: stream.priority,
      is_active: stream.is_active,
    });
    setShowStreamForm(true);
  };

  const handleStreamSubmit = async () => {
    if (!editing) return;
    if (!streamForm.url.trim()) {
      toast.error("La URL del stream es obligatoria");
      return;
    }

    const payload: Partial<Stream> = {
      url: streamForm.url.trim(),
      stream_format: streamForm.stream_format,
      priority: streamForm.priority,
      is_active: streamForm.is_active,
    };

    try {
      setSavingStream(true);
      if (editingStream) {
        await adminAPI.updateStream(editing.id, editingStream.id, payload);
        toast.success("Stream actualizado");
      } else {
        await adminAPI.addStream(editing.id, payload);
        toast.success("Stream agregado");
      }
      // Refresh channel to get updated streams
      const res = await adminAPI.getChannel(editing.id);
      setStreams(res.data.data.streams || []);
      setShowStreamForm(false);
      setEditingStream(null);
      fetchChannels();
    } catch {
      toast.error(
        editingStream ? "Error al actualizar stream" : "Error al agregar stream"
      );
    } finally {
      setSavingStream(false);
    }
  };

  const openDeleteStreamConfirm = (stream: Stream) => {
    setDeletingStream(stream);
    setDeleteStreamConfirm(true);
  };

  const handleDeleteStream = async () => {
    if (!editing || !deletingStream) return;
    try {
      await adminAPI.deleteStream(editing.id, deletingStream.id);
      toast.success("Stream eliminado");
      setDeleteStreamConfirm(false);
      setDeletingStream(null);
      const res = await adminAPI.getChannel(editing.id);
      setStreams(res.data.data.streams || []);
      fetchChannels();
    } catch {
      toast.error("Error al eliminar stream");
    }
  };

  // --- Emisión Local handlers ---
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadFileName(file.name);

    try {
      await adminAPI.uploadMedia(file, (pct) => setUploadProgress(pct));
      toast.success("Archivo subido correctamente");
      fetchMediaList();
      startPolling();
    } catch {
      toast.error("Error al subir archivo");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteMedia = async (mediaId: number) => {
    try {
      await adminAPI.deleteMedia(mediaId);
      toast.success("Archivo eliminado");
      fetchMediaList();
    } catch {
      toast.error("Error al eliminar archivo");
    }
  };

  const handleAddToPlaylist = async (media: LocalMedia) => {
    if (!editing) return;
    try {
      const sortOrder = playlist?.items?.length || 0;
      await adminAPI.addPlaylistItem(editing.id, {
        local_media_id: media.id,
        sort_order: sortOrder,
      });
      toast.success("Agregado a la playlist");
      fetchPlaylist(editing.id);
    } catch {
      toast.error("Error al agregar a playlist");
    }
  };

  const handleRemoveFromPlaylist = async (itemId: number) => {
    if (!editing) return;
    try {
      await adminAPI.removePlaylistItem(editing.id, itemId);
      toast.success("Eliminado de la playlist");
      fetchPlaylist(editing.id);
    } catch {
      toast.error("Error al eliminar de playlist");
    }
  };

  const handleMoveItem = async (index: number, direction: "up" | "down") => {
    if (!editing || !playlist?.items) return;
    const items = [...playlist.items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
    const reordered = items.map((item, i) => ({ id: item.id, sort_order: i }));

    try {
      await adminAPI.reorderPlaylist(editing.id, reordered);
      fetchPlaylist(editing.id);
    } catch {
      toast.error("Error al reordenar");
    }
  };

  const handlePlaybackModeChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    if (!editing) return;
    try {
      await adminAPI.updatePlaylistMode(editing.id, e.target.value);
      toast.success("Modo actualizado");
      fetchPlaylist(editing.id);
    } catch {
      toast.error("Error al cambiar modo");
    }
  };

  const handleGenerateStream = async () => {
    if (!editing) return;
    setGeneratingStream(true);
    try {
      await adminAPI.generatePlaylistStream(editing.id);
      toast.success("Stream generado correctamente");
      // Refresh channel streams
      const res = await adminAPI.getChannel(editing.id);
      setStreams(res.data.data.streams || []);
      fetchChannels();
    } catch {
      toast.error("Error al generar stream");
    } finally {
      setGeneratingStream(false);
    }
  };

  // --- Emission (live ffmpeg) handlers ---
  const fetchEmissionStatus = useCallback(async (channelId: number) => {
    try {
      const res = await adminAPI.getEmissionStatus(channelId);
      setEmissionStatus(res.data.data || null);
    } catch {
      setEmissionStatus(null);
    }
  }, []);

  const startEmissionPolling = useCallback((channelId: number) => {
    if (emissionPollingRef.current) return;
    emissionPollingRef.current = setInterval(() => {
      fetchEmissionStatus(channelId);
    }, 5000);
  }, [fetchEmissionStatus]);

  const stopEmissionPolling = useCallback(() => {
    if (emissionPollingRef.current) {
      clearInterval(emissionPollingRef.current);
      emissionPollingRef.current = null;
    }
  }, []);

  // Stop emission polling when modal closes
  useEffect(() => {
    if (!modalOpen) {
      stopEmissionPolling();
      setEmissionStatus(null);
    }
  }, [modalOpen, stopEmissionPolling]);

  // Auto-poll when emission is starting or running
  useEffect(() => {
    if (editing && emissionStatus && (emissionStatus.status === "starting" || emissionStatus.status === "running")) {
      startEmissionPolling(editing.id);
    } else {
      stopEmissionPolling();
    }
  }, [editing, emissionStatus?.status, startEmissionPolling, stopEmissionPolling]);

  const handleStartEmission = async () => {
    if (!editing) return;
    setEmissionLoading(true);
    try {
      await adminAPI.startEmission(editing.id);
      toastRef.current.success("Emision iniciada");
      fetchEmissionStatus(editing.id);
    } catch {
      toastRef.current.error("Error al iniciar emision");
    } finally {
      setEmissionLoading(false);
    }
  };

  const handleStopEmission = async () => {
    if (!editing) return;
    setEmissionLoading(true);
    try {
      await adminAPI.stopEmission(editing.id);
      toastRef.current.success("Emision detenida");
      stopEmissionPolling();
      fetchEmissionStatus(editing.id);
      // Refresh streams
      const res = await adminAPI.getChannel(editing.id);
      setStreams(res.data.data.streams || []);
    } catch {
      toastRef.current.error("Error al detener emision");
    } finally {
      setEmissionLoading(false);
    }
  };

  // --- Stream selection + M3U download handlers ---
  const toggleStreamSelection = (streamId: number) => {
    setSelectedStreamIds((prev) => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  };

  const toggleAllStreams = () => {
    if (selectedStreamIds.size === streams.length) {
      setSelectedStreamIds(new Set());
    } else {
      setSelectedStreamIds(new Set(streams.map((s) => s.id)));
    }
  };

  const buildFullUrl = (streamUrl: string) => {
    if (streamUrl.startsWith("http://") || streamUrl.startsWith("https://")) {
      return streamUrl;
    }
    if (typeof window !== "undefined") {
      return `${window.location.origin}${streamUrl.startsWith("/") ? "" : "/"}${streamUrl}`;
    }
    return streamUrl;
  };

  const downloadStreamM3U = (stream: Stream) => {
    const channelName = editing?.name || "Channel";
    const fullUrl = buildFullUrl(stream.url);
    const content = [
      "#EXTM3U",
      `#EXTINF:-1,${channelName} - ${stream.stream_format.toUpperCase()} (P${stream.priority})`,
      fullUrl,
      "",
    ].join("\n");

    const blob = new Blob([content], { type: "audio/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${channelName.replace(/[^a-zA-Z0-9_-]/g, "_")}_stream_${stream.id}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadSelectedM3U = () => {
    const channelName = editing?.name || "Channel";
    const selectedStreams = streams.filter((s) => selectedStreamIds.has(s.id));
    if (selectedStreams.length === 0) return;

    const lines: string[] = ["#EXTM3U"];
    for (const stream of selectedStreams) {
      const fullUrl = buildFullUrl(stream.url);
      lines.push(`#EXTINF:-1,${channelName} - ${stream.stream_format.toUpperCase()} (P${stream.priority})`);
      lines.push(fullUrl);
    }
    lines.push("");

    const content = lines.join("\n");
    const blob = new Blob([content], { type: "audio/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${channelName.replace(/[^a-zA-Z0-9_-]/g, "_")}_streams.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const categoryOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const columns = [
    {
      key: "name",
      label: "Nombre",
      render: (item: ChannelList) => (
        <div className="flex items-center gap-3">
          {item.logo_url ? (
            <img
              src={item.logo_url}
              alt={item.name}
              className="h-8 w-8 rounded-lg object-cover bg-dark-700"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-dark-700 flex items-center justify-center text-dark-400 text-xs">
              TV
            </div>
          )}
          <span className="font-medium text-dark-100">{item.name}</span>
        </div>
      ),
    },
    {
      key: "category",
      label: "Categoria",
      render: (item: ChannelList) => (
        <span className="text-dark-300">
          {item.category?.name || "Sin categoria"}
        </span>
      ),
    },
    {
      key: "stream_count",
      label: "Streams",
      render: (item: ChannelList) => (
        <span className="rounded-full bg-dark-700 px-2 py-0.5 text-xs font-medium text-dark-200">
          {item.stream_count}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "Estado",
      render: (item: ChannelList) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            item.is_active
              ? "bg-green-600/20 text-green-400"
              : "bg-red-600/20 text-red-400"
          }`}
        >
          {item.is_active ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Acciones",
      render: (item: ChannelList) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(item)}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Editar
          </button>
          <button
            onClick={() => openDeleteConfirm(item)}
            className="rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/30"
          >
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  // Check if a media item is already in the playlist
  const isInPlaylist = (mediaId: number) => {
    return playlist?.items?.some((item) => item.local_media_id === mediaId) || false;
  };

  // Count completed items in playlist
  const completedPlaylistItems = playlist?.items?.filter(
    (item) => item.local_media?.status === "completed"
  ).length || 0;

  const totalPlaylistItems = playlist?.items?.length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100">Canales</h1>
        <button onClick={openCreateModal} className="btn-primary px-4 py-2 text-sm">
          Nuevo Canal
        </button>
      </div>

      <DataTable columns={columns} data={channels} loading={loading} emptyMessage="No hay canales" />

      <div className="mt-4">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Channel Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar Canal" : "Nuevo Canal"}
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Channel Fields */}
          <FormInput
            label="Nombre"
            name="name"
            value={channelForm.name}
            onChange={handleChannelChange}
            required
            placeholder="Nombre del canal"
          />

          <FormSelect
            label="Categoria"
            name="category_id"
            value={channelForm.category_id}
            onChange={handleChannelChange}
            options={categoryOptions}
          />

          <FormInput
            label="URL del Logo"
            name="logo_url"
            value={channelForm.logo_url}
            onChange={handleChannelChange}
            placeholder="https://ejemplo.com/logo.png"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="EPG Channel ID"
              name="epg_channel_id"
              value={channelForm.epg_channel_id}
              onChange={handleChannelChange}
              placeholder="ID del canal EPG"
            />

            <FormInput
              label="Numero de Canal"
              name="channel_number"
              type="number"
              value={channelForm.channel_number}
              onChange={handleChannelChange}
              placeholder="Ej: 1"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              checked={channelForm.is_active}
              onChange={handleChannelChange}
              className="h-4 w-4 rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-dark-200">
              Canal activo
            </label>
          </div>

          {/* Save / Cancel Channel */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-700">
            <button
              onClick={() => setModalOpen(false)}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleChannelSubmit}
              disabled={saving}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : editing
                ? "Actualizar Canal"
                : "Crear Canal"}
            </button>
          </div>

          {/* Tabs: Streams / Emisión Local (only in edit mode) */}
          {editing && (
            <div className="pt-4 border-t border-dark-700">
              {/* Tab Selector */}
              <div className="flex gap-1 mb-4 bg-dark-900 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("streams")}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "streams"
                      ? "bg-dark-700 text-dark-100"
                      : "text-dark-400 hover:text-dark-200"
                  }`}
                >
                  Streams Externos
                </button>
                <button
                  onClick={() => setActiveTab("emision")}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "emision"
                      ? "bg-dark-700 text-dark-100"
                      : "text-dark-400 hover:text-dark-200"
                  }`}
                >
                  Emision Local
                </button>
              </div>

              {/* ===== STREAMS TAB ===== */}
              {activeTab === "streams" && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-dark-100">Streams</h3>
                      {streams.length > 0 && (
                        <label className="flex items-center gap-1.5 text-xs text-dark-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStreamIds.size === streams.length && streams.length > 0}
                            onChange={toggleAllStreams}
                            className="h-3.5 w-3.5 rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500"
                          />
                          Todos
                        </label>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedStreamIds.size > 0 && (
                        <button
                          onClick={downloadSelectedM3U}
                          className="flex items-center gap-1.5 rounded-lg bg-dark-700 px-3 py-1.5 text-xs font-medium text-dark-200 transition-colors hover:bg-dark-600"
                        >
                          Descargar M3U ({selectedStreamIds.size})
                        </button>
                      )}
                      <button
                        onClick={openAddStream}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        Agregar Stream
                      </button>
                    </div>
                  </div>

                  {loadingStreams ? (
                    <div className="py-4 text-center text-sm text-dark-400">
                      Cargando streams...
                    </div>
                  ) : streams.length === 0 && !showStreamForm ? (
                    <p className="py-4 text-center text-sm text-dark-400">
                      Este canal no tiene streams configurados.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {streams.map((stream) => (
                        <div
                          key={stream.id}
                          className="flex flex-col sm:flex-row sm:items-center rounded-lg border border-dark-700 bg-dark-900 px-4 py-3 gap-2"
                        >
                          <div className="flex items-center flex-1 min-w-0">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={selectedStreamIds.has(stream.id)}
                              onChange={() => toggleStreamSelection(stream.id)}
                              className="h-4 w-4 rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500 shrink-0 mr-3"
                            />

                            {/* Stream info */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-sm text-dark-200 truncate">
                                {stream.url}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="rounded-full bg-dark-700 px-2 py-0.5 text-xs font-medium text-dark-300">
                                  {stream.stream_format.toUpperCase()}
                                </span>
                                <span className="text-xs text-dark-400">
                                  Prioridad: {stream.priority}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    stream.is_active
                                      ? "bg-green-600/20 text-green-400"
                                      : "bg-red-600/20 text-red-400"
                                  }`}
                                >
                                  {stream.is_active ? "Activo" : "Inactivo"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 flex-wrap sm:ml-3 shrink-0 pl-7 sm:pl-0">
                            <button
                              onClick={() => setPreviewStream(stream)}
                              className="rounded-lg bg-primary-600/20 px-2.5 py-1.5 text-xs font-medium text-primary-400 transition-colors hover:bg-primary-600/30"
                              title="Previsualizar stream"
                            >
                              ▶
                            </button>
                            <button
                              onClick={() => downloadStreamM3U(stream)}
                              className="rounded-lg bg-dark-700 px-2.5 py-1.5 text-xs font-medium text-dark-300 transition-colors hover:bg-dark-600 hover:text-dark-200"
                              title="Descargar .m3u"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => openEditStream(stream)}
                              className="btn-secondary px-3 py-1.5 text-xs"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => openDeleteStreamConfirm(stream)}
                              className="rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/30"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline Stream Form */}
                  {showStreamForm && (
                    <div className="mt-4 rounded-lg border border-dark-600 bg-dark-900 p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-dark-200">
                        {editingStream ? "Editar Stream" : "Nuevo Stream"}
                      </h4>

                      <FormInput
                        label="URL"
                        name="url"
                        value={streamForm.url}
                        onChange={handleStreamChange}
                        required
                        placeholder="https://ejemplo.com/stream.m3u8"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormSelect
                          label="Formato"
                          name="stream_format"
                          value={streamForm.stream_format}
                          onChange={handleStreamChange}
                          options={FORMAT_OPTIONS}
                          required
                        />

                        <FormInput
                          label="Prioridad"
                          name="priority"
                          type="number"
                          value={streamForm.priority}
                          onChange={handleStreamChange}
                          placeholder="0"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          id="stream_is_active"
                          name="is_active"
                          type="checkbox"
                          checked={streamForm.is_active}
                          onChange={handleStreamChange}
                          className="h-4 w-4 rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500"
                        />
                        <label
                          htmlFor="stream_is_active"
                          className="text-sm font-medium text-dark-200"
                        >
                          Stream activo
                        </label>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          onClick={() => {
                            setShowStreamForm(false);
                            setEditingStream(null);
                          }}
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleStreamSubmit}
                          disabled={savingStream}
                          className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          {savingStream
                            ? "Guardando..."
                            : editingStream
                            ? "Actualizar Stream"
                            : "Agregar Stream"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== EMISIÓN LOCAL TAB ===== */}
              {activeTab === "emision" && (
                <div className="space-y-6">
                  {/* Upload Section */}
                  <div>
                    <h3 className="text-base font-semibold text-dark-100 mb-3">
                      Subir Archivo de Video
                    </h3>
                    <div
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        uploading
                          ? "border-primary-500/50 bg-primary-500/5"
                          : "border-dark-600 hover:border-dark-500 hover:bg-dark-800/50"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_EXTENSIONS}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      {uploading ? (
                        <div className="space-y-3">
                          <div className="text-sm text-dark-200">
                            Subiendo: {uploadFileName}
                          </div>
                          <div className="w-full bg-dark-700 rounded-full h-2.5">
                            <div
                              className="bg-primary-500 h-2.5 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <div className="text-xs text-dark-400">
                            {uploadProgress}%
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-3xl text-dark-500">+</div>
                          <div className="text-sm text-dark-300">
                            Click para seleccionar archivo
                          </div>
                          <div className="text-xs text-dark-500">
                            Formatos: MP4, MKV, AVI, WebM, MOV, FLV, TS, M4V, WMV (max 500MB)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Media Library */}
                  <div>
                    <h3 className="text-base font-semibold text-dark-100 mb-3">
                      Biblioteca de Medios
                    </h3>
                    {mediaLoading ? (
                      <div className="py-4 text-center text-sm text-dark-400">
                        Cargando archivos...
                      </div>
                    ) : mediaList.length === 0 ? (
                      <p className="py-4 text-center text-sm text-dark-400">
                        No hay archivos subidos. Sube un video para comenzar.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {mediaList.map((media) => (
                          <div
                            key={media.id}
                            className="flex items-center justify-between rounded-lg border border-dark-700 bg-dark-900 px-4 py-3"
                          >
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-sm text-dark-200 truncate">
                                {media.original_filename}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-dark-400">
                                  {formatFileSize(media.file_size)}
                                </span>
                                {media.duration > 0 && (
                                  <span className="text-xs text-dark-400">
                                    {formatDuration(media.duration)}
                                  </span>
                                )}
                                {media.resolution && (
                                  <span className="rounded-full bg-dark-700 px-2 py-0.5 text-xs font-medium text-dark-300">
                                    {media.resolution}
                                  </span>
                                )}
                                {/* Status badge */}
                                {media.status === "completed" && (
                                  <span className="rounded-full bg-green-600/20 px-2 py-0.5 text-xs font-medium text-green-400">
                                    Listo
                                  </span>
                                )}
                                {media.status === "processing" && (
                                  <span className="rounded-full bg-yellow-600/20 px-2 py-0.5 text-xs font-medium text-yellow-400">
                                    Transcodificando {media.progress}%
                                  </span>
                                )}
                                {media.status === "pending" && (
                                  <span className="rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                                    Pendiente
                                  </span>
                                )}
                                {media.status === "failed" && (
                                  <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-xs font-medium text-red-400">
                                    Error
                                  </span>
                                )}
                              </div>
                              {/* Transcoding progress bar */}
                              {(media.status === "processing" || media.status === "pending") && (
                                <div className="w-full bg-dark-700 rounded-full h-1.5 mt-1">
                                  <div
                                    className={`h-1.5 rounded-full transition-all duration-500 ${
                                      media.status === "processing"
                                        ? "bg-yellow-500"
                                        : "bg-blue-500"
                                    }`}
                                    style={{ width: `${media.progress}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-3 shrink-0">
                              {media.status === "completed" && !isInPlaylist(media.id) && (
                                <button
                                  onClick={() => handleAddToPlaylist(media)}
                                  className="btn-primary px-3 py-1.5 text-xs"
                                >
                                  + Playlist
                                </button>
                              )}
                              {isInPlaylist(media.id) && (
                                <span className="rounded-full bg-primary-600/20 px-2 py-0.5 text-xs font-medium text-primary-400">
                                  En playlist
                                </span>
                              )}
                              <button
                                onClick={() => handleDeleteMedia(media.id)}
                                className="rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/30"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Playlist Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold text-dark-100">
                        Playlist del Canal
                      </h3>
                      {totalPlaylistItems > 0 && (
                        <span className="text-xs text-dark-400">
                          {completedPlaylistItems}/{totalPlaylistItems} listos
                        </span>
                      )}
                    </div>

                    {/* Playback Mode Selector */}
                    <div className="mb-3">
                      <FormSelect
                        label="Modo de Reproduccion"
                        name="playback_mode"
                        value={playlist?.playback_mode || "loop"}
                        onChange={handlePlaybackModeChange}
                        options={PLAYBACK_MODE_OPTIONS}
                      />
                    </div>

                    {playlistLoading ? (
                      <div className="py-4 text-center text-sm text-dark-400">
                        Cargando playlist...
                      </div>
                    ) : !playlist?.items || playlist.items.length === 0 ? (
                      <p className="py-4 text-center text-sm text-dark-400">
                        La playlist esta vacia. Sube videos y agregalos desde la biblioteca.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {playlist.items.map((item: PlaylistItem, index: number) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-lg border border-dark-700 bg-dark-900 px-4 py-3"
                          >
                            {/* Order controls */}
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button
                                onClick={() => handleMoveItem(index, "up")}
                                disabled={index === 0}
                                className="text-dark-400 hover:text-dark-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs leading-none"
                                title="Subir"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => handleMoveItem(index, "down")}
                                disabled={index === playlist.items.length - 1}
                                className="text-dark-400 hover:text-dark-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs leading-none"
                                title="Bajar"
                              >
                                ▼
                              </button>
                            </div>

                            {/* Order number */}
                            <span className="text-xs font-mono text-dark-500 w-5 text-center shrink-0">
                              {index + 1}
                            </span>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-dark-200 truncate">
                                {item.local_media?.original_filename || `Media #${item.local_media_id}`}
                              </p>
                              <div className="flex items-center gap-2">
                                {item.local_media?.duration && item.local_media.duration > 0 && (
                                  <span className="text-xs text-dark-400">
                                    {formatDuration(item.local_media.duration)}
                                  </span>
                                )}
                                {item.local_media?.resolution && (
                                  <span className="text-xs text-dark-400">
                                    {item.local_media.resolution}
                                  </span>
                                )}
                                {item.local_media?.status === "completed" ? (
                                  <span className="rounded-full bg-green-600/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
                                    Listo
                                  </span>
                                ) : item.local_media?.status === "processing" ? (
                                  <span className="rounded-full bg-yellow-600/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                                    {item.local_media.progress}%
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {/* Remove button */}
                            <button
                              onClick={() => handleRemoveFromPlaylist(item.id)}
                              className="text-dark-500 hover:text-red-400 transition-colors shrink-0"
                              title="Eliminar de playlist"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Generate Stream Button */}
                    <div className="mt-4 pt-4 border-t border-dark-700">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-dark-200">
                            Generar Stream HLS
                          </p>
                          <p className="text-xs text-dark-400 mt-0.5">
                            Crea un stream a partir de la playlist para emitir en este canal
                          </p>
                        </div>
                        <button
                          onClick={handleGenerateStream}
                          disabled={generatingStream || completedPlaylistItems === 0}
                          className="btn-primary px-4 py-2 text-sm disabled:opacity-50 shrink-0"
                        >
                          {generatingStream ? "Generando..." : "Generar Stream"}
                        </button>
                      </div>
                      {completedPlaylistItems === 0 && totalPlaylistItems > 0 && (
                        <p className="text-xs text-yellow-400 mt-2">
                          Espera a que al menos un video termine de transcodificarse.
                        </p>
                      )}
                    </div>

                    {/* Emission en Vivo Section */}
                    <div className="mt-4 pt-4 border-t border-dark-700">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-dark-200">
                              Emision en Vivo
                            </p>
                            {emissionStatus?.status === "running" && (
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-xs font-medium text-red-400">EN VIVO</span>
                              </span>
                            )}
                            {emissionStatus?.status === "starting" && (
                              <span className="text-xs font-medium text-yellow-400">Iniciando...</span>
                            )}
                            {emissionStatus?.status === "error" && (
                              <span className="text-xs font-medium text-red-400">Error</span>
                            )}
                          </div>
                          <p className="text-xs text-dark-400 mt-0.5">
                            Inicia una emision en vivo con ffmpeg. Los usuarios veran el stream en tiempo real.
                          </p>
                          {emissionStatus?.error && (
                            <p className="text-xs text-red-400 mt-1 max-w-md truncate" title={emissionStatus.error}>
                              {emissionStatus.error}
                            </p>
                          )}
                        </div>
                        {emissionStatus?.status === "running" || emissionStatus?.status === "starting" ? (
                          <button
                            onClick={handleStopEmission}
                            disabled={emissionLoading}
                            className="rounded-lg bg-red-600/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-50 shrink-0"
                          >
                            {emissionLoading ? "Deteniendo..." : "Detener Emision"}
                          </button>
                        ) : (
                          <button
                            onClick={handleStartEmission}
                            disabled={emissionLoading || completedPlaylistItems === 0}
                            className="btn-primary px-4 py-2 text-sm disabled:opacity-50 shrink-0"
                          >
                            {emissionLoading ? "Iniciando..." : "Iniciar Emision"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Channel Confirm */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        onConfirm={handleDeleteChannel}
        onCancel={() => {
          setDeleteConfirm(false);
          setDeletingItem(null);
        }}
        title="Eliminar Canal"
        message={`Estas seguro de eliminar el canal "${deletingItem?.name}"? Se eliminaran todos sus streams. Esta accion no se puede deshacer.`}
      />

      {/* Delete Stream Confirm */}
      <ConfirmDialog
        isOpen={deleteStreamConfirm}
        onConfirm={handleDeleteStream}
        onCancel={() => {
          setDeleteStreamConfirm(false);
          setDeletingStream(null);
        }}
        title="Eliminar Stream"
        message="Estas seguro de eliminar este stream? Esta accion no se puede deshacer."
      />

      {/* Stream Preview Player */}
      <VideoPlayer
        isOpen={previewStream !== null}
        onClose={() => setPreviewStream(null)}
        url={previewStream?.url || ""}
        format={previewStream?.stream_format || "hls"}
        title={editing ? `${editing.name} - Preview` : "Stream Preview"}
      />
    </div>
  );
}
