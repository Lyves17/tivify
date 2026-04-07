"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

const sidebarKeys = [
  { href: "/admin", key: "admin.dashboard", icon: "📊" },
  { href: "/admin/channels", key: "admin.channels", icon: "📺" },
  { href: "/admin/iptv", key: "admin.iptv", icon: "📡" },
  { href: "/admin/vod", key: "admin.vod", icon: "🎬" },
  { href: "/admin/series", key: "admin.series", icon: "📚" },
  { href: "/admin/categories", key: "admin.categories", icon: "📁" },
  { href: "/admin/library", key: "admin.library", icon: "💿" },
  { href: "/admin/epg", key: "admin.epg", icon: "📅" },
  { href: "/admin/users", key: "admin.users", icon: "👤" },
  { href: "/admin/tailscale", key: "admin.tailscale", icon: "🌐" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-dark-400">{t("common.loading")}</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 px-4 bg-dark-900 border-b border-dark-700 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-dark-300 hover:text-dark-100 p-1"
        >
          <Menu size={24} />
        </button>
        <Link href="/admin" className="text-lg font-bold text-primary-500">
          TIVIFY
        </Link>
        <div className="w-8" />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-dark-900 border-r border-dark-700 flex flex-col",
          "transform transition-transform duration-200 ease-in-out",
          "md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-2xl font-bold text-primary-500">
              TIVIFY
            </Link>
            <p className="text-dark-500 text-xs mt-1">{t("admin.adminPanel")}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-dark-400 hover:text-dark-100 p-1"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {sidebarKeys.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/admin" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary-600/20 text-primary-400"
                    : "text-dark-300 hover:bg-dark-800 hover:text-dark-100"
                )}
              >
                <span>{link.icon}</span>
                <span>{t(link.key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-dark-200">
                {user.username}
              </p>
              <p className="text-xs text-dark-500">{user.role}</p>
              <p className="text-xs text-dark-600 mt-1">v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-dark-400 hover:text-red-400 text-sm transition-colors"
            >
              {t("auth.logoutShort")}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="pt-14 md:pt-0 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
