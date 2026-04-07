package com.tivify.app.util

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class RetryUtilTest {

    @Test
    fun `succeeds on first attempt`() = runTest {
        var attempts = 0
        val result = retryWithBackoff(maxRetries = 3, initialDelayMs = 1) {
            attempts++
            "success"
        }
        assertEquals("success", result)
        assertEquals(1, attempts)
    }

    @Test
    fun `succeeds after retries`() = runTest {
        var attempts = 0
        val result = retryWithBackoff(maxRetries = 3, initialDelayMs = 1) {
            attempts++
            if (attempts < 3) throw RuntimeException("fail")
            "success"
        }
        assertEquals("success", result)
        assertEquals(3, attempts)
    }

    @Test
    fun `throws after exhausting retries`() = runTest {
        var attempts = 0
        try {
            retryWithBackoff(maxRetries = 2, initialDelayMs = 1) {
                attempts++
                throw RuntimeException("always fails")
            }
            fail("Should have thrown")
        } catch (e: RuntimeException) {
            assertEquals("always fails", e.message)
        }
        assertEquals(2, attempts)
    }

    @Test
    fun `single retry succeeds`() = runTest {
        var attempts = 0
        val result = retryWithBackoff(maxRetries = 1, initialDelayMs = 1) {
            attempts++
            "immediate"
        }
        assertEquals("immediate", result)
        assertEquals(1, attempts)
    }

    @Test
    fun `respects max retries count`() = runTest {
        var attempts = 0
        try {
            retryWithBackoff(maxRetries = 4, initialDelayMs = 1) {
                attempts++
                throw RuntimeException("fail")
            }
        } catch (_: RuntimeException) {}
        assertEquals(4, attempts)
    }

    @Test
    fun `returns correct value type`() = runTest {
        val result = retryWithBackoff(maxRetries = 1, initialDelayMs = 1) { 42 }
        assertEquals(42, result)
    }
}
