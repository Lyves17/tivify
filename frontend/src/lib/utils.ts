import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolve a URL to an absolute URL
 * - Allows absolute URLs (http/https)
 * - Only allows relative paths starting with /api/, /media/, /live/, /movie/, /series/
 * - Throws error for invalid paths to prevent URL injection
 * @param url The URL to resolve
 * @returns The absolute URL
 * @throws Error if the URL is invalid
 */
export function resolveUrl(url: string): string {
  // Allow absolute URLs
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Validate relative paths - only allow specific safe prefixes
  const allowedPrefixes = ["/api/", "/media/", "/live/", "/movie/", "/series/"];
  if (!allowedPrefixes.some(prefix => url.startsWith(prefix))) {
    throw new Error(`Invalid URL path: ${url}. Only relative paths starting with /api/, /media/, /live/, /movie/, /series/ are allowed.`);
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${url}`;
  }
  return url;
}

export function formatDurationHuman(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function formatDurationTimer(seconds: number): string {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function isValidURL(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
