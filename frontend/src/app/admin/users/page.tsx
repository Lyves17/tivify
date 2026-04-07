"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import DataTable from "@/components/ui/data-table";
import Pagination from "@/components/ui/pagination";
import Modal from "@/components/ui/modal";
import FormInput from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { adminAPI } from "@/lib/api";
import { useToast } from "@/context/toast-context";
import { useAuth } from "@/context/auth-context";
import type { UserAdmin } from "@/lib/types";

interface UserForm {
  username: string;
  email: string;
  password: string;
  role: string;
  is_active: boolean;
  max_connections: string;
  exp_date: string;
}

const emptyForm: UserForm = {
  username: "",
  email: "",
  password: "",
  role: "user",
  is_active: true,
  max_connections: "1",
  exp_date: "",
};

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
];

export default function UsersPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();

  const [data, setData] = useState<UserAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserAdmin | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<UserAdmin | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers(page, 20);
      setData(res.data.data || []);
      setTotalPages(res.data.meta.pages);
    } catch {
      toast.error("Error al cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: UserAdmin) => {
    setEditingItem(item);
    setForm({
      username: item.username,
      email: item.email,
      password: "",
      role: item.role,
      is_active: item.is_active,
      max_connections: String(item.max_connections),
      exp_date: item.exp_date ? item.exp_date.split("T")[0] : "",
    });
    setModalOpen(true);
  };

  const openDelete = (item: UserAdmin) => {
    setDeletingItem(item);
    setDeleteConfirm(true);
  };

  const handleSubmit = async () => {
    if (!form.username.trim()) {
      toast.error("El nombre de usuario es obligatorio");
      return;
    }
    if (!form.email.trim()) {
      toast.error("El email es obligatorio");
      return;
    }
    if (!editingItem && !form.password.trim()) {
      toast.error("La contrasena es obligatoria");
      return;
    }

    const payload: Record<string, unknown> = {
      username: form.username,
      email: form.email,
      role: form.role,
      is_active: form.is_active,
      max_connections: form.max_connections ? Number(form.max_connections) : 1,
      exp_date: form.exp_date || null,
    };

    if (form.password) {
      payload.password = form.password;
    }

    try {
      if (editingItem) {
        await adminAPI.updateUser(editingItem.id, payload);
        toast.success("Usuario actualizado correctamente");
      } else {
        await adminAPI.createUser(payload);
        toast.success("Usuario creado correctamente");
      }
      setModalOpen(false);
      fetchData();
    } catch {
      toast.error("Error al guardar el usuario");
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await adminAPI.deleteUser(deletingItem.id);
      toast.success("Usuario eliminado correctamente");
      setDeleteConfirm(false);
      setDeletingItem(null);
      fetchData();
    } catch {
      toast.error("Error al eliminar el usuario");
    }
  };

  const columns = [
    { key: "username", label: "Username" },
    { key: "email", label: "Email" },
    {
      key: "role",
      label: "Rol",
      render: (item: UserAdmin) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            item.role === "admin"
              ? "bg-purple-500/20 text-purple-400"
              : "bg-blue-500/20 text-blue-400"
          }`}
        >
          {item.role}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "Estado",
      render: (item: UserAdmin) => (
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
    { key: "max_connections", label: "Conexiones Max" },
    {
      key: "exp_date",
      label: "Expiracion",
      render: (item: UserAdmin) =>
        item.exp_date ? new Date(item.exp_date).toLocaleDateString("es-ES") : "—",
    },
    {
      key: "created_at",
      label: "Creado",
      render: (item: UserAdmin) =>
        new Date(item.created_at).toLocaleDateString("es-ES"),
    },
    {
      key: "actions",
      label: "Acciones",
      render: (item: UserAdmin) => (
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
            disabled={currentUser?.id === item.id}
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            title={currentUser?.id === item.id ? "No puedes eliminar tu propio usuario" : "Eliminar"}
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
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100">Usuarios</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Plus size={16} />
          Crear Usuario
        </button>
      </div>

      <DataTable columns={columns} data={data} loading={loading} emptyMessage="No hay usuarios disponibles" />

      <div className="mt-4">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Editar Usuario" : "Crear Usuario"}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          <FormInput
            label="Username"
            name="username"
            value={form.username}
            onChange={handleChange}
            required
          />
          <FormInput
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <FormInput
            label="Contrasena"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required={!editingItem}
            placeholder={editingItem ? "Dejar vacio para no cambiar" : ""}
          />
          <FormSelect
            label="Rol"
            name="role"
            value={form.role}
            onChange={handleChange}
            options={roleOptions}
            required
          />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Conexiones Max"
              name="max_connections"
              type="number"
              value={form.max_connections}
              onChange={handleChange}
            />
            <FormInput
              label="Fecha de Expiracion"
              name="exp_date"
              type="date"
              value={form.exp_date}
              onChange={handleChange}
            />
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

      <ConfirmDialog
        isOpen={deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteConfirm(false);
          setDeletingItem(null);
        }}
        title="Eliminar Usuario"
        message={`¿Estas seguro de que deseas eliminar al usuario "${deletingItem?.username}"? Esta accion no se puede deshacer.`}
      />
    </div>
  );
}
