"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import GlobalSearch from "@/components/ui/global-search";

const navKeys = [
  { href: "/home", key: "nav.home" },
  { href: "/channels", key: "nav.channels" },
  { href: "/vod", key: "nav.vod" },
  { href: "/series", key: "nav.series" },
  { href: "/guide", key: "nav.guide" },
  { href: "/favorites", key: "nav.favorites" },
  { href: "/history", key: "nav.history" },
];

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-dark-400">{t("common.loading")}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[999] focus:p-4 focus:bg-primary-600 focus:text-white focus:rounded-br-lg"
      >
        {t("common.skipToContent")}
      </a>
      <header className="bg-dark-900 border-b border-dark-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-dark-300 hover:text-dark-100 p-1 -ml-1"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-menu"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <Link
                href="/home"
                className="text-xl font-bold text-primary-500"
              >
                TIVIFY
              </Link>
              <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
                {navKeys.map((link) => {
                  const isActive = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-primary-600/20 text-primary-400"
                          : "text-dark-300 hover:bg-dark-800 hover:text-dark-100"
                      )}
                    >
                      {t(link.key)}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <GlobalSearch />
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-dark-400 hover:text-primary-400 text-sm transition-colors"
                >
                  {t("nav.admin")}
                </Link>
              )}
              <Link
                href="/settings"
                className="text-dark-300 hover:text-dark-100 text-sm transition-colors"
              >
                {user?.username}
              </Link>
              <button
                onClick={handleLogout}
                className="text-dark-400 hover:text-red-400 text-sm transition-colors"
              >
                {t("auth.logoutShort")}
              </button>
            </div>

            <div className="md:hidden flex items-center gap-2">
              <GlobalSearch />
              <Link
                href="/settings"
                className="text-dark-300 text-sm"
              >
                {user?.username}
              </Link>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-dark-700 bg-dark-900" id="mobile-nav-menu" role="navigation">
            <nav className="px-4 py-3 space-y-1" aria-label="Mobile navigation">
              {navKeys.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "block px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-primary-600/20 text-primary-400"
                        : "text-dark-300 hover:bg-dark-800 hover:text-dark-100"
                    )}
                  >
                    {t(link.key)}
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 py-3 border-t border-dark-700 space-y-1">
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className="block px-3 py-2.5 rounded-lg text-sm text-dark-400 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                >
                  {t("nav.adminPanel")}
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm text-dark-400 hover:text-red-400 hover:bg-dark-800 transition-colors"
              >
                {t("auth.logout")}
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1" id="main-content">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
