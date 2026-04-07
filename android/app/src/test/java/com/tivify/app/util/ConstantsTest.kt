package com.tivify.app.util

import org.junit.Assert.*
import org.junit.Test

class ConstantsTest {

    @Test
    fun `network timeouts are positive`() {
        assertTrue(Constants.HTTP_CONNECT_TIMEOUT_MS > 0)
        assertTrue(Constants.HTTP_READ_TIMEOUT_MS > 0)
    }

    @Test
    fun `search debounce is positive`() {
        assertTrue(Constants.SEARCH_DEBOUNCE_MS > 0)
    }

    @Test
    fun `player config values are positive`() {
        assertTrue(Constants.PLAYER_CONTROLLER_TIMEOUT_MS > 0)
        assertTrue(Constants.PLAYER_SEEK_INCREMENT_MS > 0)
    }

    @Test
    fun `pagination defaults are reasonable`() {
        assertEquals(20, Constants.DEFAULT_PAGE_SIZE)
        assertEquals(50, Constants.CHANNELS_PAGE_SIZE)
        assertTrue(Constants.DEFAULT_PAGE_SIZE > 0)
        assertTrue(Constants.CHANNELS_PAGE_SIZE > Constants.DEFAULT_PAGE_SIZE)
    }

    @Test
    fun `saved accounts and servers max size`() {
        assertEquals(10, Constants.SAVED_ACCOUNTS_MAX_SIZE)
        assertEquals(10, Constants.SAVED_SERVERS_MAX_SIZE)
    }

    @Test
    fun `API paths are correct`() {
        assertEquals("/auth/login", Constants.AUTH_LOGIN_PATH)
        assertEquals("/auth/refresh", Constants.AUTH_REFRESH_PATH)
    }

    @Test
    fun `TV safe area values are positive`() {
        assertTrue(Constants.TV_SAFE_AREA_HORIZONTAL_DP > 0)
        assertTrue(Constants.TV_SAFE_AREA_VERTICAL_DP > 0)
    }
}
