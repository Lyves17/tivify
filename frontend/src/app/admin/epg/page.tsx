"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import Pagination from "@/components/ui/pagination";
import Modal from "@/components/ui/modal";
import FormInput from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { adminAPI } from "@/lib/api";
import { useToast } from "@/context/toast-context";
import type { EPGEntry, ChannelList } from "@/lib/types";

interface EPGForm {
  channel_id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  category: string;
  language: string;
  episode_num: string;
}

const emptyForm: EPGForm = {
  channel_id: "",
  title: "",
  description: "",
  start_time: "",
  end_time: "",
  category: "",
  language: "",
  episode_num: "",
};

function toDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EPGPage() {
  const toast = useToast();

  const [data, setData] = useState<EPGEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EPGEntry | null>(null);
  const [form, setForm] = useState<EPGForm>(emptyForm);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<EPGEntry | null>(null);

  const [channels, setChannels] = useState<ChannelList[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getEPG(page, 20);
      setData(res.data.data || []);
      setTotalPages(res.data.meta.pages);
    } catch {
      toast.error("Error al cargar la guia EPG");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await adminAPI.getChannels(1, 1000);
      setChannels(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch channels for EPG:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const channelOptions = channels.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: EPGEntry) => {
    setEditingItem(item);
    setForm({
      channel_id: String(item.channel_id),
      title: item.title,
      description: item.description || "",
      start_time: toDatetimeLocal(item.start_time),
      end_time: toDatetimeLocal(item.end_time),
      category: item.category || "",
      language: item.language || "",
      episode_num: item.episode_num || "",
    });
    setModalOpen(true);
  };

  const openDelete = (item: EPGEntry) => {
    setDeletingItem(item);
    setDeleteConfirm(true);
  };

  const handleSubmit = async () => {
    if (!form.channel_id) {
      toast.error("El canal es obligatorio");
      return;
    }
    if (!form.title.trim()) {
      toast.error("El titulo es obligatorio");
      return;
    }

    const payload: Record<string, unknown> = {
      channel_id: Number(form.channel_id),
      title: form.title,
      description: form.description,
      start_time: form.start_time ? new Date(form.start_time).toISOString() : "",
      end_time: form.end_time ? new Date(form.end_time).toISOString() : "",
      category: form.category,
      language: form.language,
      episode_num: form.episode_num,
    };

    try {
      if (editingItem) {
        await adminAPI.updateEPG(editingItem.id, payload);
        toast.success("Entrada EPG actualizada correctamente");
      } else {
        await adminAPI.createEPG(payload);
        toast.success("Entrada EPG creada correctamente");
      }
      setModalOpen(false);
      fetchData();
    } catch {
      toast.error("Error al guardar la entrada EPG");
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await adminAPI.deleteEPG(deletingItem.id);
      toast.success("Entrada EPG eliminada correctamente");
      setDeleteConfirm(false);
      setDeletingItem(null);
      fetchData();
    } catch {
      toast.error("Error al eliminar la entrada EPG");
    }
  };

  const columns = [
    {
      key: "channel_name",
      label: "Canal",
      render: (item: EPGEntry) => item.channel_name || channels.find((c) => c.id === item.channel_id)?.name || "—",
    },
    { key: "title", label: "Titulo" },
    {
      key: "start_time",
      label: "Inicio",
      render: (item: EPGEntry) =>
        item.start_time ? new Date(item.start_time).toLocaleString("es-ES") : "—",
    },
    {
      key: "end_time",
      label: "Fin",
      render: (item: EPGEntry) =>
        item.end_time ? new Date(item.end_time).toLocaleString("es-ES") : "—",
    },
    { key: "category", label: "Categoria" },
    {
      key: "actions",
      label: "Acciones",
      render: (item: EPGEntry) => (
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100">Guia EPG</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Plus size={16} />
          Crear Entrada
        </button>
      </div>

      <DataTable columns={columns} data={data} loading={loading} emptyMessage="No hay entradas EPG disponibles" />

      <div className="mt-4">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Editar Entrada EPG" : "Crear Entrada EPG"}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          <FormSelect
            label="Canal"
            name="channel_id"
            value={form.channel_id}
            onChange={handleChange}
            options={channelOptions}
            required
          />
          <FormInput
            label="Titulo"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />
          <FormTextarea
            label="Descripcion"
            name="description"
            value={form.description}
            onChange={handleChange}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Inicio"
              name="start_time"
              type="datetime-local"
              value={form.start_time}
              onChange={handleChange}
            />
            <FormInput
              label="Fin"
              name="end_time"
              type="datetime-local"
              value={form.end_time}
              onChange={handleChange}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Categoria"
              name="category"
              value={form.category}
              onChange={handleChange}
            />
            <FormInput
              label="Idioma"
              name="language"
              value={form.language}
              onChange={handleChange}
            />
          </div>
          <FormInput
            label="Numero de Episodio"
            name="episode_num"
            value={form.episode_num}
            onChange={handleChange}
          />

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

      <ConfirmDialog
        isOpen={deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteConfirm(false);
          setDeletingItem(null);
        }}
        title="Eliminar Entrada EPG"
        message={`¿Estas seguro de que deseas eliminar "${deletingItem?.title}"? Esta accion no se puede deshacer.`}
      />
    </div>
  );
}
