"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-dark-100 mb-4">
          {t("error.title")}
        </h2>
        <p className="text-dark-400 mb-6">
          {t("error.message")}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
        >
          {t("error.retry")}
        </button>
      </div>
    </div>
  );
}
