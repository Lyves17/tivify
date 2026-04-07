package com.tivify.app.ui.login

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Basic tests for LoginState data class.
 * Full LoginViewModel tests require Hilt + ApplicationContext
 * which is only available in Android instrumentation tests.
 */
class LoginViewModelTest {

    @Test
    fun `LoginState default values`() {
        val state = LoginState()
        assertEquals("", state.serverUrl)
        assertEquals("", state.username)
        assertEquals("", state.password)
        assertEquals(false, state.isLoading)
        assertEquals(null, state.error)
        assertEquals(false, state.isLoggedIn)
        assertEquals(true, state.rememberMe)
        assertEquals(emptyList<Any>(), state.savedAccounts)
        assertEquals(emptyList<String>(), state.savedServers)
    }

    @Test
    fun `LoginState copy works`() {
        val state = LoginState()
        val updated = state.copy(serverUrl = "http://test.com", username = "admin")
        assertEquals("http://test.com", updated.serverUrl)
        assertEquals("admin", updated.username)
        assertEquals("", updated.password)
    }

    @Test
    fun `LoginState with error`() {
        val state = LoginState(error = "Invalid credentials")
        assertEquals("Invalid credentials", state.error)
    }

    @Test
    fun `LoginState isLoading flag`() {
        val state = LoginState(isLoading = true)
        assertEquals(true, state.isLoading)
    }
}
