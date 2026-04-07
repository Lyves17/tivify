import type { Metadata } from "next";
import { AuthProvider } from "@/context/auth-context";
import { ToastProvider } from "@/context/toast-context";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TIVIFY",
    template: "%s | TIVIFY",
  },
  description: "Plataforma de streaming IPTV con canales en vivo, películas y series",
  keywords: ["IPTV", "streaming", "canales", "películas", "series", "contenido en vivo"],
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://example.com"),
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  themeColor: "#4f46e5",
  robots: {
    index: true,
    follow: true,
    noarchive: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
    },
  },
  openGraph: {
    title: "TIVIFY",
    description: "Plataforma de streaming IPTV con canales en vivo, películas y series",
    type: "website",
    siteName: "TIVIFY",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "TIVIFY",
    description: "Plataforma de streaming IPTV",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
