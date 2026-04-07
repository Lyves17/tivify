"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-7xl font-bold text-primary-500 mb-2">404</p>
        <h1 className="text-2xl font-bold text-dark-100 mb-3">
          {t("notFound.title")}
        </h1>
        <p className="text-dark-400 mb-8">
          {t("notFound.message")}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          {t("notFound.backHome")}
        </Link>
      </div>
    </div>
  );
}
