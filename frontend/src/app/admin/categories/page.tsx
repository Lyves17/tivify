"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { adminAPI } from "@/lib/api";
import type { Category } from "@/lib/types";
import { useToast } from "@/context/toast-context";
import DataTable from "@/components/ui/data-table";
import Pagination from "@/components/ui/pagination";
import Modal from "@/components/ui/modal";
import FormInput from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import ConfirmDialog from "@/components/ui/confirm-dialog";

const TYPE_OPTIONS = [
  { value: "live", label: "Live" },
  { value: "vod", label: "VOD" },
  { value: "series", label: "Series" },
];

const FILTER_TYPES = ["all", "live", "vod", "series"] as const;

const EMPTY_FORM = {
  name: "",
  type: "live" as "live" | "vod" | "series",
  sort_order: 0,
  parent_id: "",
};

export default function CategoriesPage() {
  const toast = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filterType, setFilterType] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Category | null>(null);

  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getCategories(page, 50);
      let data = res.data.data || [];
      const meta = res.data.meta;

      if (filterType !== "all") {
        data = data.filter((c) => c.type === filterType);
      }

      setCategories(data);
      setTotalPages(meta.pages);
    } catch {
      toast.error("Error al cargar categorias");
    } finally {
      setLoading(false);
    }
  }, [page, filterType, toast]);

  const fetchAllCategories = useCallback(async () => {
    try {
      const res = await adminAPI.getCategories(1, 200);
      setAllCategories(res.data.data || []);
    } catch (error) {
      // Silently fail for parent category list, but log error for debugging
      console.error("Failed to fetch all categories for parent list:", error);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchAllCategories();
  }, [fetchAllCategories]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "sort_order" ? Number(value) : value,
    }));
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      type: category.type,
      sort_order: category.sort_order,
      parent_id: category.parent_id ? String(category.parent_id) : "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!form.type) {
      toast.error("El tipo es obligatorio");
      return;
    }

    const payload: Partial<Category> = {
      name: form.name.trim(),
      type: form.type,
      sort_order: form.sort_order,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
    };

    try {
      setSaving(true);
      if (editing) {
        await adminAPI.updateCategory(editing.id, payload);
        toast.success("Categoria actualizada");
      } else {
        await adminAPI.createCategory(payload);
        toast.success("Categoria creada");
      }
      setModalOpen(false);
      fetchCategories();
      fetchAllCategories();
    } catch {
      toast.error(
        editing ? "Error al actualizar categoria" : "Error al crear categoria"
      );
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = (category: Category) => {
    setDeletingItem(category);
    setDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await adminAPI.deleteCategory(deletingItem.id);
      toast.success("Categoria eliminada");
      setDeleteConfirm(false);
      setDeletingItem(null);
      fetchCategories();
      fetchAllCategories();
    } catch {
      toast.error("Error al eliminar categoria");
    }
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      live: "bg-green-600/20 text-green-400",
      vod: "bg-blue-600/20 text-blue-400",
      series: "bg-purple-600/20 text-purple-400",
    };
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          colors[type] || "bg-dark-700 text-dark-300"
        }`}
      >
        {type.toUpperCase()}
      </span>
    );
  };

  const parentOptions = allCategories
    .filter((c) => (editing ? c.id !== editing.id : true))
    .map((c) => ({ value: String(c.id), label: c.name }));

  const columns = [
    { key: "name", label: "Nombre" },
    { key: "slug", label: "Slug" },
    {
      key: "type",
      label: "Tipo",
      render: (item: Category) => typeBadge(item.type),
    },
    {
      key: "sort_order",
      label: "Orden",
      render: (item: Category) => (
        <span className="text-dark-300">{item.sort_order}</span>
      ),
    },
    {
      key: "actions",
      label: "Acciones",
      render: (item: Category) => (
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100">Categorias</h1>
        <button onClick={openCreateModal} className="btn-primary px-4 py-2 text-sm">
          Nueva Categoria
        </button>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTER_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => {
              setFilterType(type);
              setPage(1);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filterType === type
                ? "bg-primary-600 text-white"
                : "btn-secondary"
            }`}
          >
            {type === "all" ? "Todos" : type.toUpperCase()}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={categories} loading={loading} emptyMessage="No hay categorias" />

      <div className="mt-4">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar Categoria" : "Nueva Categoria"}
      >
        <div className="space-y-4">
          <FormInput
            label="Nombre"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="Nombre de la categoria"
          />

          <FormSelect
            label="Tipo"
            name="type"
            value={form.type}
            onChange={handleChange}
            options={TYPE_OPTIONS}
            required
          />

          <FormInput
            label="Orden"
            name="sort_order"
            type="number"
            value={form.sort_order}
            onChange={handleChange}
            placeholder="0"
          />

          <FormSelect
            label="Categoria padre (opcional)"
            name="parent_id"
            value={form.parent_id}
            onChange={handleChange}
            options={parentOptions}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-700">
            <button
              onClick={() => setModalOpen(false)}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : editing
                ? "Actualizar"
                : "Crear"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteConfirm(false);
          setDeletingItem(null);
        }}
        title="Eliminar Categoria"
        message={`Estas seguro de eliminar la categoria "${deletingItem?.name}"? Esta accion no se puede deshacer.`}
      />
    </div>
  );
}
