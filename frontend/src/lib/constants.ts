/**
 * Application-wide constants
 * Centralized place for magic numbers and configuration values
 */

// Pagination
export const PAGINATION_DEFAULT_PER_PAGE = 20;

// UI/UX
export const TOAST_AUTO_DISMISS_MS = 3000;
export const SEARCH_DEBOUNCE_MS = 500;

// API
export const API_TIMEOUT_MS = 30000;
export const API_SLOW_REQUEST_THRESHOLD_MS = 10000;

// Validation
export const MAX_SEARCH_LENGTH = 200;

// Streaming
export const HLS_MAX_RETRIES = 3;
export const LIVE_CHANNELS_POLL_INTERVAL_MS = 30000;

// Form validation
export const PASSWORD_MIN_LENGTH = 8;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const CHANNEL_NAME_MAX_LENGTH = 100;
export const CATEGORY_NAME_MAX_LENGTH = 100;
export const VOD_TITLE_MAX_LENGTH = 255;
export const DESCRIPTION_MAX_LENGTH = 5000;

// Upload
export const MAX_FILE_SIZE_MB = 500;
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
