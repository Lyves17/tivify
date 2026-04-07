package com.tivify.app.data.api

import retrofit2.http.*

interface TivifyApi {

    // --- Auth ---

    @POST("v1/auth/login")
    suspend fun login(@Body body: LoginRequest): ApiResponse<AuthData>

    @POST("v1/auth/refresh")
    suspend fun refresh(): ApiResponse<RefreshData>

    @POST("v1/auth/logout")
    suspend fun logout()

    @GET("v1/auth/me")
    suspend fun me(): ApiResponse<UserData>

    // --- Channels ---

    @GET("v1/channels")
    suspend fun getChannels(
        @Query("page") page: Int = 1,
        @Query("per_page") perPage: Int = 20,
        @Query("category_id") categoryId: Int? = null
    ): PaginatedResponse<ChannelData>

    @GET("v1/channels/{id}")
    suspend fun getChannel(@Path("id") id: Int): ApiResponse<ChannelData>

    // --- VOD ---

    @GET("v1/vod")
    suspend fun getVods(
        @Query("page") page: Int = 1,
        @Query("per_page") perPage: Int = 20,
        @Query("search") search: String? = null,
        @Query("category_id") categoryId: Int? = null
    ): PaginatedResponse<VodData>

    @GET("v1/vod/{id}")
    suspend fun getVod(@Path("id") id: Int): ApiResponse<VodData>

    // --- Series ---

    @GET("v1/series")
    suspend fun getSeries(
        @Query("page") page: Int = 1,
        @Query("per_page") perPage: Int = 20,
        @Query("search") search: String? = null,
        @Query("category_id") categoryId: Int? = null
    ): PaginatedResponse<SeriesData>

    @GET("v1/series/{id}")
    suspend fun getSeriesById(@Path("id") id: Int): ApiResponse<SeriesData>

    @GET("v1/series/{id}/episodes")
    suspend fun getEpisodes(@Path("id") seriesId: Int): ApiResponse<List<VodData>>

    // --- Categories ---

    @GET("v1/categories")
    suspend fun getCategories(@Query("type") type: String): ApiResponse<List<CategoryData>>

    // --- EPG ---

    @GET("v1/epg")
    suspend fun getEpg(
        @Query("channel_id") channelId: Int,
        @Query("date") date: String? = null
    ): ApiResponse<List<EpgEntry>>

    // --- Emissions ---

    @GET("v1/emissions/live")
    suspend fun getLiveChannels(): ApiResponse<LiveChannelsData>

    // --- Favorites ---

    @GET("v1/favorites")
    suspend fun getFavorites(
        @Query("page") page: Int = 1,
        @Query("per_page") perPage: Int = 20
    ): PaginatedResponse<FavoriteData>

    @POST("v1/favorites/toggle")
    suspend fun toggleFavorite(@Body body: ToggleFavoriteRequest): ApiResponse<ToggleResult>

    // --- History ---

    @GET("v1/history/continue")
    suspend fun getContinueWatching(
        @Query("limit") limit: Int = 10
    ): ApiResponse<List<ContinueWatchingData>>

    @GET("v1/history")
    suspend fun getHistory(
        @Query("page") page: Int = 1,
        @Query("per_page") perPage: Int = 20
    ): PaginatedResponse<HistoryData>

    @POST("v1/history")
    suspend fun recordHistory(@Body body: RecordHistoryRequest)

    @DELETE("v1/history/{id}")
    suspend fun deleteHistory(@Path("id") id: Int)

    // --- Version ---

    @GET("version")
    suspend fun getVersion(): ApiResponse<Map<String, String>>

    // --- Profile ---

    @PUT("v1/profile")
    suspend fun updateProfile(@Body body: UpdateProfileRequest)

    @PUT("v1/profile/password")
    suspend fun changePassword(@Body body: ChangePasswordRequest)
}
