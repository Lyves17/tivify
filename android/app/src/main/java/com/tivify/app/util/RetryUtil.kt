package com.tivify.app.util

import kotlinx.coroutines.delay
import timber.log.Timber

/**
 * Retry a suspending block with exponential backoff.
 *
 * @param maxRetries Total number of attempts (default 3)
 * @param initialDelayMs Initial delay between retries in milliseconds (default 1000ms)
 * @param maxDelayMs Maximum delay cap in milliseconds (default 10000ms)
 * @param factor Exponential backoff multiplier (default 2.0)
 * @param block The suspending function to retry
 * @return The result of the successful execution
 * @throws The last exception if all retries are exhausted
 */
suspend fun <T> retryWithBackoff(
    maxRetries: Int = 3,
    initialDelayMs: Long = 1000,
    maxDelayMs: Long = 10000,
    factor: Double = 2.0,
    block: suspend () -> T
): T {
    var currentDelay = initialDelayMs
    repeat(maxRetries - 1) { attempt ->
        try {
            return block()
        } catch (e: Exception) {
            Timber.w(e, "Retry attempt ${attempt + 1}/$maxRetries failed")
        }
        delay(currentDelay.coerceAtMost(maxDelayMs))
        currentDelay = (currentDelay * factor).toLong()
    }
    return block()
}
