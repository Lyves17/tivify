"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { adminAPI } from "@/lib/api";
import { useToast } from "@/context/toast-context";
import type { DashboardStats } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    completed: "bg-green-600/20 text-green-400",
    processing: "bg-yellow-600/20 text-yellow-400",
    pending: "bg-dark-600/20 text-dark-300",
    failed: "bg-red-600/20 text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getStats();
      setStats(res.data.data);
    } catch (error) {
      setStats(null);
      toast.error("Error al cargar estadisticas del dashboard");
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-dark-100 mb-6">Dashboard</h1>
        <LoadingSpinner text="Cargando estadisticas..." />
      </div>
    );
  }

  const problemVods = stats?.problem_vods || [];
  const recentVods = stats?.recent_vods || [];
  const recentUsers = stats?.recent_users || [];

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-dark-100 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Canales" value={stats?.channels ?? 0} description="Canales activos" icon="📺" />
        <StatCard title="VODs" value={stats?.vods ?? 0} description="Videos disponibles" icon="🎬" />
        <StatCard title="Series" value={stats?.series ?? 0} description="Series activas" icon="📚" />
        <StatCard title="Usuarios" value={stats?.users ?? 0} description="Usuarios registrados" icon="👤" />
      </div>

      {/* Problem VODs */}
      {problemVods.length > 0 && (
        <div className="mt-8 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-200">Requieren atencion</h2>
            <span className="text-xs text-dark-400">{problemVods.length} VODs</span>
          </div>
          <div className="space-y-2">
            {problemVods.map((v) => (
              <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-800/50">
                <div className="flex items-center gap-3 min-w-0">
                  {statusBadge(v.transcode_status)}
                  <span className="text-dark-100 text-sm truncate">{v.title}</span>
                </div>
                {v.transcode_status === "processing" && (
                  <span className="text-xs text-dark-400 shrink-0">{v.transcode_progress}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent VODs */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-200">Ultimos VODs</h2>
            <Link href="/admin/vod" className="text-xs text-primary-400 hover:text-primary-300">Ver todos</Link>
          </div>
          {recentVods.length === 0 ? (
            <p className="text-dark-400 text-sm">Sin VODs aun</p>
          ) : (
            <div className="space-y-2">
              {recentVods.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-800/50">
                  <div className="flex items-center gap-3 min-w-0">
                    {statusBadge(v.transcode_status)}
                    <span className="text-dark-100 text-sm truncate">{v.title}</span>
                  </div>
                  <span className="text-xs text-dark-400 shrink-0">{formatDate(v.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Users */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-200">Ultimos usuarios</h2>
            <Link href="/admin/users" className="text-xs text-primary-400 hover:text-primary-300">Ver todos</Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-dark-400 text-sm">Sin usuarios aun</p>
          ) : (
            <div className="space-y-2">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-800/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-purple-600/20 text-purple-400" : "bg-dark-600/20 text-dark-300"}`}>
                      {u.role}
                    </span>
                    <span className="text-dark-100 text-sm truncate">{u.username}</span>
                  </div>
                  <span className="text-xs text-dark-400 shrink-0">{formatDate(u.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, description, icon }: { title: string; value: number; description: string; icon: string }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <p className="text-dark-400 text-sm">{title}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-dark-100 mt-1">{value.toLocaleString()}</p>
      <p className="text-dark-500 text-xs mt-1">{description}</p>
    </div>
  );
}
