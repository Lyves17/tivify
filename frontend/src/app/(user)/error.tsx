"use client";

import { useEffect } from "react";

export default function UserError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("User section error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <h2 className="text-xl font-bold text-dark-100 mb-3">
        Error al cargar la página
      </h2>
      <p className="text-dark-400 mb-6 text-sm">
        Ha ocurrido un error inesperado. Por favor intenta de nuevo.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium"
      >
        Reintentar
      </button>
    </div>
  );
}
