package com.tivify.app.data.api

import com.google.gson.Gson
import org.junit.Assert.*
import org.junit.Test

class ModelsTest {

    private val gson = Gson()

    // --- ApiResponse ---

    @Test
    fun `ApiResponse success with data`() {
        val response = ApiResponse(success = true, data = "hello", message = null)
        assertTrue(response.success)
        assertEquals("hello", response.data)
        assertNull(response.message)
    }

    @Test
    fun `ApiResponse error with message`() {
        val response = ApiResponse<String>(success = false, data = null, message = "error occurred")
        assertFalse(response.success)
        assertNull(response.data)
        assertEquals("error occurred", response.message)
    }

    // --- PaginatedResponse ---

    @Test
    fun `PaginatedResponse with meta`() {
        val meta = PaginationMeta(total = 100, page = 1, perPage = 20, pages = 5)
        val response = PaginatedResponse(success = true, data = listOf("a", "b"), meta = meta)
        assertTrue(response.success)
        assertEquals(2, response.data?.size)
        assertEquals(100, response.meta.total)
        assertEquals(5, response.meta.pages)
    }

    @Test
    fun `PaginationMeta serialization`() {
        val json = """{"total":50,"page":2,"per_page":10,"pages":5}"""
        val meta = gson.fromJson(json, PaginationMeta::class.java)
        assertEquals(50, meta.total)
        assertEquals(2, meta.page)
        assertEquals(10, meta.perPage)
        assertEquals(5, meta.pages)
    }

    // --- Auth models ---

    @Test
    fun `LoginRequest fields`() {
        val req = LoginRequest(username = "admin", password = "secret")
        assertEquals("admin", req.username)
        assertEquals("secret", req.password)
    }

    @Test
    fun `AuthData deserialization`() {
        val json = """{"access_token":"jwt123","user":{"id":"uuid1","username":"admin","email":"a@b.com","role":"admin","is_active":true}}"""
        val auth = gson.fromJson(json, AuthData::class.java)
        assertEquals("jwt123", auth.accessToken)
        assertEquals("admin", auth.user.username)
        assertTrue(auth.user.isActive)
    }

    @Test
    fun `RefreshData deserialization`() {
        val json = """{"access_token":"new-token-123"}"""
        val refresh = gson.fromJson(json, RefreshData::class.java)
        assertEquals("new-token-123", refresh.accessToken)
    }

    @Test
    fun `UserData deserialization`() {
        val json = """{"id":"uuid-123","username":"john","email":"john@test.com","role":"user","is_active":false}"""
        val user = gson.fromJson(json, UserData::class.java)
        assertEquals("uuid-123", user.id)
        assertEquals("john", user.username)
        assertEquals("john@test.com", user.email)
        assertEquals("user", user.role)
        assertFalse(user.isActive)
    }

    // --- Content models ---

    @Test
    fun `ChannelData deserialization`() {
        val json = """{"id":1,"name":"CNN","slug":"cnn","logo_url":"http://logo.png","category_id":5,"epg_channel_id":"cnn.us","channel_number":100,"is_active":true,"streams":[],"category":null,"stream_count":2}"""
        val channel = gson.fromJson(json, ChannelData::class.java)
        assertEquals(1, channel.id)
        assertEquals("CNN", channel.name)
        assertEquals("cnn", channel.slug)
        assertEquals("http://logo.png", channel.logoUrl)
        assertEquals(5, channel.categoryId)
        assertEquals(100, channel.channelNumber)
        assertTrue(channel.isActive)
        assertEquals(2, channel.streamCount)
    }

    @Test
    fun `VodData deserialization`() {
        val json = """{"id":10,"title":"Movie","slug":"movie","description":"A movie","poster_url":"http://p.jpg","backdrop_url":"http://b.jpg","hls_path":"/media/hls","duration":7200,"resolution":"1080p","year":2020,"rating":8.5,"is_active":true,"series_id":null,"season_number":0,"episode_number":0,"transcode_status":"completed","category":null,"direct_play_path":null}"""
        val vod = gson.fromJson(json, VodData::class.java)
        assertEquals(10, vod.id)
        assertEquals("Movie", vod.title)
        assertEquals(7200, vod.duration)
        assertEquals("1080p", vod.resolution)
        assertEquals(2020, vod.year)
        assertEquals(8.5, vod.rating, 0.01)
        assertTrue(vod.isActive)
        assertNull(vod.seriesId)
    }

    @Test
    fun `SeriesData deserialization`() {
        val json = """{"id":5,"title":"Breaking Bad","slug":"breaking-bad","description":"Chemistry teacher","poster_url":"","backdrop_url":"","year":2008,"rating":9.5,"total_seasons":5,"is_active":true,"episodes_count":62,"category":null}"""
        val series = gson.fromJson(json, SeriesData::class.java)
        assertEquals("Breaking Bad", series.title)
        assertEquals(5, series.totalSeasons)
        assertEquals(62, series.episodesCount)
    }

    @Test
    fun `CategoryData fields`() {
        val cat = CategoryData(id = 1, name = "Sports", slug = "sports", type = "channel")
        assertEquals(1, cat.id)
        assertEquals("Sports", cat.name)
        assertEquals("channel", cat.type)
    }

    @Test
    fun `StreamData deserialization`() {
        val json = """{"id":1,"url":"http://stream.m3u8","stream_format":"hls","priority":1,"is_active":true,"user_agent":null,"headers":null}"""
        val stream = gson.fromJson(json, StreamData::class.java)
        assertEquals("hls", stream.streamFormat)
        assertTrue(stream.isActive)
    }

    @Test
    fun `FavoriteData deserialization`() {
        val json = """{"id":1,"favoritable_type":"channel","favoritable_id":5,"created_at":"2025-01-01T00:00:00Z"}"""
        val fav = gson.fromJson(json, FavoriteData::class.java)
        assertEquals("channel", fav.favoritableType)
        assertEquals(5, fav.favoritableId)
    }

    @Test
    fun `HistoryData deserialization`() {
        val json = """{"id":1,"content_type":"vod","content_id":10,"progress":300,"duration":7200,"watched_at":"2025-01-01T12:00:00Z"}"""
        val history = gson.fromJson(json, HistoryData::class.java)
        assertEquals("vod", history.contentType)
        assertEquals(300, history.progress)
    }

    @Test
    fun `ContinueWatchingData deserialization`() {
        val json = """{"id":1,"content_type":"vod","content_id":10,"progress":600,"duration":7200,"watched_at":"2025-01-01","content_name":"Movie","content_poster":"http://p.jpg","content_slug":"movie"}"""
        val cw = gson.fromJson(json, ContinueWatchingData::class.java)
        assertEquals("Movie", cw.contentName)
        assertEquals("movie", cw.contentSlug)
    }

    @Test
    fun `LiveChannelsData deserialization`() {
        val json = """{"live_channel_ids":[1,2,3]}"""
        val live = gson.fromJson(json, LiveChannelsData::class.java)
        assertEquals(listOf(1, 2, 3), live.liveChannelIds)
    }

    // --- Request models ---

    @Test
    fun `ToggleFavoriteRequest fields`() {
        val req = ToggleFavoriteRequest(type = "channel", id = 5)
        assertEquals("channel", req.type)
        assertEquals(5, req.id)
    }

    @Test
    fun `ToggleResult fields`() {
        val result = ToggleResult(added = true)
        assertTrue(result.added)
    }

    @Test
    fun `RecordHistoryRequest serialization`() {
        val req = RecordHistoryRequest(contentType = "vod", contentId = 10, progress = 300, duration = 7200)
        val json = gson.toJson(req)
        assertTrue(json.contains("content_type"))
        assertTrue(json.contains("content_id"))
    }

    @Test
    fun `UpdateProfileRequest fields`() {
        val req = UpdateProfileRequest(email = "new@email.com")
        assertEquals("new@email.com", req.email)
    }

    @Test
    fun `ChangePasswordRequest serialization`() {
        val req = ChangePasswordRequest(currentPassword = "old", newPassword = "new")
        val json = gson.toJson(req)
        assertTrue(json.contains("current_password"))
        assertTrue(json.contains("new_password"))
    }

    // --- Data class equality ---

    @Test
    fun `data class equality works`() {
        val u1 = UserData(id = "1", username = "a", email = "a@b.com", role = "user", isActive = true)
        val u2 = UserData(id = "1", username = "a", email = "a@b.com", role = "user", isActive = true)
        assertEquals(u1, u2)
    }

    @Test
    fun `data class copy works`() {
        val u1 = UserData(id = "1", username = "a", email = "a@b.com", role = "user", isActive = true)
        val u2 = u1.copy(username = "b")
        assertEquals("b", u2.username)
        assertEquals("1", u2.id)
    }
}
