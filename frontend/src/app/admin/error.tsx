"use client";

import { AlertTriangle } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <AlertTriangle size={48} className="text-red-400 mb-4" />
      <h2 className="text-xl font-semibold text-dark-100 mb-2">Error en el panel</h2>
      <p className="text-dark-400 mb-6 text-center max-w-md">
        Ocurrio un error inesperado. Intenta recargar la seccion.
      </p>
      <button
        onClick={reset}
        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
