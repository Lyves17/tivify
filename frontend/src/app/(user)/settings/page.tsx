"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { User, HelpCircle, Info, LogOut, Lock, Mail, Globe } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { userAPI } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/context/toast-context";
import FormInput from "@/components/ui/form-input";
import axios from "axios";

interface ServerVersion {
  version: string;
  build_date: string;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { t, i18n } = useTranslation();

  // Profile form
  const [email, setEmail] = useState(user?.email || "");
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {}
  );
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Server version
  const [serverVersion, setServerVersion] = useState<ServerVersion | null>(
    null
  );

  useEffect(() => {
    axios
      .get<{ success: boolean; data: ServerVersion }>("/api/version")
      .then((res) => {
        if (res.data.success) setServerVersion(res.data.data);
      })
      .catch(() => {});
  }, []);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await userAPI.updateProfile({ email });
      toast.success(t("settings.profileUpdated"));
    } catch {
      toast.error(t("settings.profileError"));
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
    if (passwordErrors[name]) {
      setPasswordErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!passwords.current_password) {
      errors.current_password = t("settings.currentPasswordRequired");
    }
    if (!passwords.new_password) {
      errors.new_password = t("settings.newPasswordRequired");
    } else if (passwords.new_password.length < 8) {
      errors.new_password = t("settings.passwordMinLength");
    }
    if (passwords.new_password !== passwords.confirm_password) {
      errors.confirm_password = t("settings.passwordsDontMatch");
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setPasswordLoading(true);
    try {
      await userAPI.changePassword({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      toast.success(t("settings.passwordChanged"));
      setPasswords({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setPasswordErrors({});
    } catch {
      toast.error(t("settings.passwordError"));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t("settings.title")}</h1>

      {/* User info card */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-600/20 flex items-center justify-center">
            <User size={24} className="text-primary-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-dark-100">
              {user?.username}
            </p>
            <p className="text-sm text-dark-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary-600/20 flex items-center justify-center">
              <Mail size={20} className="text-primary-400" />
            </div>
            <h2 className="text-lg font-semibold text-dark-100">{t("settings.email")}</h2>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <FormInput
              label={t("settings.email")}
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
            <div className="pt-2">
              <button
                type="submit"
                disabled={profileLoading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {profileLoading ? t("settings.saving") : t("settings.saveChanges")}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary-600/20 flex items-center justify-center">
              <Lock size={20} className="text-primary-400" />
            </div>
            <h2 className="text-lg font-semibold text-dark-100">
              {t("settings.changePassword")}
            </h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <FormInput
              label={t("settings.currentPassword")}
              name="current_password"
              type="password"
              value={passwords.current_password}
              onChange={handlePasswordChange}
              error={passwordErrors.current_password}
              required
            />
            <FormInput
              label={t("settings.newPassword")}
              name="new_password"
              type="password"
              value={passwords.new_password}
              onChange={handlePasswordChange}
              error={passwordErrors.new_password}
              required
            />
            <FormInput
              label={t("settings.confirmPassword")}
              name="confirm_password"
              type="password"
              value={passwords.confirm_password}
              onChange={handlePasswordChange}
              error={passwordErrors.confirm_password}
              required
            />
            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordLoading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {passwordLoading ? t("settings.changing") : t("settings.changePasswordBtn")}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Language selector */}
      <div className="card mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary-600/20 flex items-center justify-center">
            <Globe size={20} className="text-primary-400" />
          </div>
          <h2 className="text-lg font-semibold text-dark-100">{t("settings.language")}</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => changeLanguage("es")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              i18n.language === "es"
                ? "bg-primary-600 text-white"
                : "bg-dark-700 text-dark-300 hover:bg-dark-600"
            }`}
          >
            {t("settings.spanish")}
          </button>
          <button
            onClick={() => changeLanguage("en")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              i18n.language === "en"
                ? "bg-primary-600 text-white"
                : "bg-dark-700 text-dark-300 hover:bg-dark-600"
            }`}
          >
            {t("settings.english")}
          </button>
        </div>
      </div>

      {/* Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <Link
          href="/help"
          className="card flex items-center gap-3 hover:bg-dark-700 transition-colors"
        >
          <HelpCircle size={20} className="text-primary-400" />
          <span className="text-dark-100 font-medium">{t("settings.help")}</span>
        </Link>
      </div>

      {/* About */}
      <div className="card mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary-600/20 flex items-center justify-center">
            <Info size={20} className="text-primary-400" />
          </div>
          <h2 className="text-lg font-semibold text-dark-100">{t("settings.about")}</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-dark-400">{t("settings.appVersion")}</span>
            <span className="text-dark-200 font-mono">v{appVersion}</span>
          </div>
          {serverVersion && (
            <>
              <div className="flex justify-between">
                <span className="text-dark-400">{t("settings.serverVersion")}</span>
                <span className="text-dark-200 font-mono">
                  v{serverVersion.version}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">{t("settings.serverBuild")}</span>
                <span className="text-dark-200 font-mono text-xs">
                  {serverVersion.build_date}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="mt-6">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors font-medium"
        >
          <LogOut size={18} />
          {t("auth.logout")}
        </button>
      </div>
    </div>
  );
}
