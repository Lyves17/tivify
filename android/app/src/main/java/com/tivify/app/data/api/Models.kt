package com.tivify.app.data.api

import com.google.gson.annotations.SerializedName

// --- Generic responses ---

data class ApiResponse<T>(
    val success: Boolean,
    val data: T?,
    val message: String?
)

data class PaginatedResponse<T>(
    val success: Boolean,
    val data: List<T>?,
    val meta: PaginationMeta
)

data class PaginationMeta(
    val total: Int,
    val page: Int,
    @SerializedName("per_page") val perPage: Int,
    val pages: Int
)

// --- Auth ---

data class LoginRequest(
    val username: String,
    val password: String
)

data class AuthData(
    @SerializedName("access_token") val accessToken: String,
    val user: UserData
)

data class RefreshData(
    @SerializedName("access_token") val accessToken: String
)

data class UserData(
    val id: String,
    val username: String,
    val email: String,
    val role: String,
    @SerializedName("is_active") val isActive: Boolean
)

// --- Content ---

data class ChannelData(
    val id: Int,
    val name: String,
    val slug: String,
    @SerializedName("logo_url") val logoUrl: String,
    @SerializedName("category_id") val categoryId: Int?,
    @SerializedName("epg_channel_id") val epgChannelId: String,
    @SerializedName("channel_number") val channelNumber: Int?,
    @SerializedName("is_active") val isActive: Boolean,
    val streams: List<StreamData>?,
    val category: CategoryData?,
    @SerializedName("stream_count") val streamCount: Int?
)

data class StreamData(
    val id: Int,
    val url: String,
    @SerializedName("stream_format") val streamFormat: String,
    val priority: Int,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("user_agent") val userAgent: String?,
    val headers: String?
)

data class VodData(
    val id: Int,
    val title: String,
    val slug: String,
    val description: String,
    @SerializedName("poster_url") val posterUrl: String,
    @SerializedName("backdrop_url") val backdropUrl: String,
    @SerializedName("hls_path") val hlsPath: String,
    val duration: Int,
    val resolution: String,
    val year: Int,
    val rating: Double,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("series_id") val seriesId: Int?,
    @SerializedName("season_number") val seasonNumber: Int,
    @SerializedName("episode_number") val episodeNumber: Int,
    @SerializedName("transcode_status") val transcodeStatus: String,
    val category: CategoryData?,
    @SerializedName("direct_play_path") val directPlayPath: String?
)

data class SeriesData(
    val id: Int,
    val title: String,
    val slug: String,
    val description: String,
    @SerializedName("poster_url") val posterUrl: String,
    @SerializedName("backdrop_url") val backdropUrl: String,
    val year: Int,
    val rating: Double,
    @SerializedName("total_seasons") val totalSeasons: Int,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("episodes_count") val episodesCount: Int?,
    val category: CategoryData?
)

data class CategoryData(
    val id: Int,
    val name: String,
    val slug: String,
    val type: String
)

data class EpgEntry(
    val id: Int,
    @SerializedName("channel_id") val channelId: Int,
    @SerializedName("channel_name") val channelName: String?,
    val title: String,
    val description: String,
    @SerializedName("start_time") val startTime: String,
    @SerializedName("end_time") val endTime: String,
    val category: String,
    val language: String?
)

data class FavoriteData(
    val id: Int,
    @SerializedName("favoritable_type") val favoritableType: String,
    @SerializedName("favoritable_id") val favoritableId: Int,
    @SerializedName("created_at") val createdAt: String?
)

data class HistoryData(
    val id: Int,
    @SerializedName("content_type") val contentType: String,
    @SerializedName("content_id") val contentId: Int,
    val progress: Int,
    val duration: Int,
    @SerializedName("watched_at") val watchedAt: String
)

data class ContinueWatchingData(
    val id: Int,
    @SerializedName("content_type") val contentType: String,
    @SerializedName("content_id") val contentId: Int,
    val progress: Int,
    val duration: Int,
    @SerializedName("watched_at") val watchedAt: String,
    @SerializedName("content_name") val contentName: String,
    @SerializedName("content_poster") val contentPoster: String,
    @SerializedName("content_slug") val contentSlug: String
)

data class LiveChannelsData(
    @SerializedName("live_channel_ids") val liveChannelIds: List<Int>
)

// --- Request bodies ---

data class ToggleFavoriteRequest(
    val type: String,
    val id: Int
)

data class ToggleResult(
    val added: Boolean
)

data class RecordHistoryRequest(
    @SerializedName("content_type") val contentType: String,
    @SerializedName("content_id") val contentId: Int,
    val progress: Int,
    val duration: Int
)

data class UpdateProfileRequest(
    val email: String
)

data class ChangePasswordRequest(
    @SerializedName("current_password") val currentPassword: String,
    @SerializedName("new_password") val newPassword: String
)
