package com.tivify.app.util

/**
 * Utility functions for time formatting.
 */
object TimeUtil {
    /**
     * Format seconds into a human-readable duration string.
     * Examples: "5:30" for 330 seconds, "1:23:45" for 5025 seconds.
     */
    fun formatDuration(seconds: Long): String {
        val h = seconds / 3600
        val m = (seconds % 3600) / 60
        val s = seconds % 60
        return if (h > 0) "%d:%02d:%02d".format(h, m, s)
        else "%d:%02d".format(m, s)
    }
}
