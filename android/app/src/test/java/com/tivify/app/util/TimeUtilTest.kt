package com.tivify.app.util

import org.junit.Assert.assertEquals
import org.junit.Test

class TimeUtilTest {

    @Test
    fun `formatDuration zero seconds`() {
        assertEquals("0:00", TimeUtil.formatDuration(0))
    }

    @Test
    fun `formatDuration seconds only`() {
        assertEquals("0:30", TimeUtil.formatDuration(30))
    }

    @Test
    fun `formatDuration minutes and seconds`() {
        assertEquals("5:30", TimeUtil.formatDuration(330))
    }

    @Test
    fun `formatDuration pads seconds`() {
        assertEquals("1:05", TimeUtil.formatDuration(65))
    }

    @Test
    fun `formatDuration one hour`() {
        assertEquals("1:00:00", TimeUtil.formatDuration(3600))
    }

    @Test
    fun `formatDuration hours minutes seconds`() {
        assertEquals("1:23:45", TimeUtil.formatDuration(5025))
    }

    @Test
    fun `formatDuration pads minutes and seconds with hours`() {
        assertEquals("2:05:09", TimeUtil.formatDuration(7509))
    }

    @Test
    fun `formatDuration large value`() {
        assertEquals("10:00:00", TimeUtil.formatDuration(36000))
    }

    @Test
    fun `formatDuration one second`() {
        assertEquals("0:01", TimeUtil.formatDuration(1))
    }

    @Test
    fun `formatDuration 59 seconds`() {
        assertEquals("0:59", TimeUtil.formatDuration(59))
    }

    @Test
    fun `formatDuration exactly one minute`() {
        assertEquals("1:00", TimeUtil.formatDuration(60))
    }
}
