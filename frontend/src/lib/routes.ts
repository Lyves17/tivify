/**
 * Centralized route definitions
 * Prevents hardcoded route strings and makes refactoring easier
 */

export const ROUTES = {
  // Auth
  LOGIN: '/login',

  // User Pages
  HOME: '/home',
  CHANNELS: '/channels',
  VOD: '/vod',
  SERIES: '/series',
  FAVORITES: '/favorites',
  HISTORY: '/history',
  GUIDE: '/guide',
  SETTINGS: '/settings',
  HELP: '/help',

  // Admin
  ADMIN: '/admin',
  ADMIN_DASHBOARD: '/admin',
  ADMIN_CHANNELS: '/admin/channels',
  ADMIN_IPTV: '/admin/iptv',
  ADMIN_VOD: '/admin/vod',
  ADMIN_SERIES: '/admin/series',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_LIBRARY: '/admin/library',
  ADMIN_EPG: '/admin/epg',
  ADMIN_USERS: '/admin/users',
} as const;

/**
 * Dynamic route builders
 */
export function getChannelUrl(id: number): string {
  return `${ROUTES.CHANNELS}/${id}`;
}

export function getVODUrl(id: number): string {
  return `${ROUTES.VOD}/${id}`;
}

export function getSeriesUrl(id: number): string {
  return `${ROUTES.SERIES}/${id}`;
}

export function getAdminChannelUrl(id: number): string {
  return `${ROUTES.ADMIN_CHANNELS}/${id}`;
}

export function getAdminVODUrl(id: number): string {
  return `${ROUTES.ADMIN_VOD}/${id}`;
}

export function getAdminSeriesUrl(id: number): string {
  return `${ROUTES.ADMIN_SERIES}/${id}`;
}
