package com.tivify.app.util

/**
 * Application-wide constants.
 */
object Constants {
    // Network timeouts (milliseconds)
    const val HTTP_CONNECT_TIMEOUT_MS = 15_000
    const val HTTP_READ_TIMEOUT_MS = 15_000

    // Delays and intervals
    const val SEARCH_DEBOUNCE_MS = 400L

    // Player configuration
    const val PLAYER_CONTROLLER_TIMEOUT_MS = 8000
    const val PLAYER_SEEK_INCREMENT_MS = 10_000L

    // Pagination
    const val DEFAULT_PAGE_SIZE = 20
    const val CHANNELS_PAGE_SIZE = 50

    // UI dimensions
    const val TV_SAFE_AREA_HORIZONTAL_DP = 48
    const val TV_SAFE_AREA_VERTICAL_DP = 27

    // DataStore and preferences
    const val SAVED_ACCOUNTS_MAX_SIZE = 10
    const val SAVED_SERVERS_MAX_SIZE = 10

    // API endpoints
    const val AUTH_LOGIN_PATH = "/auth/login"
    const val AUTH_REFRESH_PATH = "/auth/refresh"
}
