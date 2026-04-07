"use client";

import { useState, useEffect, useCallback } from "react";
import { adminAPI } from "@/lib/api";
import { TailscaleStatus } from "@/lib/types";
import { useToast } from "@/context/toast-context";

export default function TailscalePage() {
  const [status, setStatus] = useState<TailscaleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const toast = useToast();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await adminAPI.getTailscaleStatus();
      setStatus(res.data.data ?? null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleAction = async (action: "start" | "stop" | "restart") => {
    setActionLoading(action);
    try {
      const labels = { start: "startTailscale", stop: "stopTailscale", restart: "restartTailscale" } as const;
      const res = await adminAPI[labels[action]]();
      const data = res.data.data;
      toast.success(data?.message || `Tailscale ${action} OK`);
      // Esperar un segundo y refrescar estado
      setTimeout(fetchStatus, 1500);
    } catch {
      toast.error(`Error al ${action === "start" ? "arrancar" : action === "stop" ? "detener" : "reiniciar"} Tailscale`);
    } finally {
      setActionLoading(null);
    }
  };

  const isRunning = status?.running === true;
  const statusColor = isRunning ? "bg-green-500" : status?.status === "not_found" ? "bg-gray-500" : "bg-red-500";
  const statusLabel = isRunning ? "En ejecucion" : status?.status === "exited" ? "Detenido" : status?.status === "not_found" ? "No encontrado" : status?.status || "Desconocido";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Tailscale VPN</h1>
      </div>

      {/* Status Card */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-dark-800 rounded-lg flex items-center justify-center text-2xl">
              🌐
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Contenedor Tailscale</h2>
              <p className="text-dark-400 text-sm">{status?.container || "tivify-tailscale"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-3 h-3 rounded-full ${statusColor} ${isRunning ? "animate-pulse" : ""}`} />
            <span className={`text-sm font-medium ${isRunning ? "text-green-400" : "text-dark-400"}`}>
              {loading ? "Cargando..." : statusLabel}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        {status && status.status !== "not_found" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-dark-800 rounded-lg p-4">
              <p className="text-dark-400 text-xs mb-1">Estado</p>
              <p className="text-white font-medium capitalize">{status.status}</p>
            </div>
            {status.started_at && status.started_at !== "0001-01-01T00:00:00Z" && (
              <div className="bg-dark-800 rounded-lg p-4">
                <p className="text-dark-400 text-xs mb-1">Iniciado</p>
                <p className="text-white font-medium text-sm">
                  {new Date(status.started_at).toLocaleString("es-ES")}
                </p>
              </div>
            )}
            {status.error && (
              <div className="bg-dark-800 rounded-lg p-4">
                <p className="text-dark-400 text-xs mb-1">Error</p>
                <p className="text-red-400 font-medium text-sm">{status.error}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleAction("start")}
            disabled={actionLoading !== null || isRunning}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-dark-700 disabled:text-dark-500 text-white rounded-lg font-medium transition-colors"
          >
            {actionLoading === "start" ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>▶</span>
            )}
            Arrancar
          </button>

          <button
            onClick={() => handleAction("stop")}
            disabled={actionLoading !== null || !isRunning}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-dark-700 disabled:text-dark-500 text-white rounded-lg font-medium transition-colors"
          >
            {actionLoading === "stop" ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>⏹</span>
            )}
            Detener
          </button>

          <button
            onClick={() => handleAction("restart")}
            disabled={actionLoading !== null || !isRunning}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-dark-700 disabled:text-dark-500 text-white rounded-lg font-medium transition-colors"
          >
            {actionLoading === "restart" ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>🔄</span>
            )}
            Reiniciar
          </button>

          <button
            onClick={() => { setLoading(true); fetchStatus(); }}
            disabled={actionLoading !== null}
            className="flex items-center gap-2 px-5 py-2.5 bg-dark-700 hover:bg-dark-600 disabled:text-dark-500 text-white rounded-lg font-medium transition-colors ml-auto"
          >
            Refrescar
          </button>
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-3">Acerca de Tailscale</h3>
        <p className="text-dark-400 text-sm leading-relaxed">
          Tailscale proporciona acceso remoto seguro a tu instancia de TIVIFY mediante una red VPN mesh.
          El contenedor comparte la red con nginx, lo que permite acceder al panel y a los streams desde
          cualquier dispositivo conectado a tu red Tailscale.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 text-dark-400">
            <span className="text-dark-500">Hostname:</span>
            <code className="bg-dark-800 px-2 py-0.5 rounded text-primary-400">tivify</code>
          </div>
          <div className="flex items-center gap-2 text-dark-400">
            <span className="text-dark-500">Modo:</span>
            <code className="bg-dark-800 px-2 py-0.5 rounded text-primary-400">HTTPS serve</code>
          </div>
        </div>
      </div>
    </div>
  );
}
