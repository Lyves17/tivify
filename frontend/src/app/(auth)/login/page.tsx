"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useTranslation } from "react-i18next";
import axios from "axios";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(username, password);
      router.push("/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message;
        if (err.response?.status === 401 || err.response?.status === 400) {
          setError(msg || t("auth.invalidCredentials"));
        } else if (err.response?.status === 403) {
          setError(msg || t("auth.accountDisabled"));
        } else if (!err.response) {
          setError(t("auth.connectionError"));
        } else {
          setError(t("auth.serverError"));
        }
      } else {
        setError(t("auth.unexpectedError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "es" ? "en" : "es";
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-500">{t("app.name")}</h1>
          <p className="text-dark-400 mt-2">{t("app.subtitle")}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-dark-100">
              {t("auth.login")}
            </h2>
            <button
              type="button"
              onClick={toggleLanguage}
              className="text-xs text-dark-400 hover:text-primary-400 transition-colors px-2 py-1 rounded border border-dark-700 hover:border-primary-500/50"
            >
              {i18n.language === "es" ? "EN" : "ES"}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-dark-300 mb-1.5"
              >
                {t("auth.username")}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder={t("auth.usernamePlaceholder")}
                required
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-dark-300 mb-1.5"
              >
                {t("auth.password")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder={t("auth.passwordPlaceholder")}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t("auth.loggingIn") : t("auth.login")}
            </button>
          </form>
        </div>

        <p className="text-center text-dark-500 text-sm mt-6">
          {t("auth.contactAdmin")}
        </p>
      </div>
    </div>
  );
}
