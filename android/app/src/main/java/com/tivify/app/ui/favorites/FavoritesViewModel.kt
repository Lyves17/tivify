package com.tivify.app.ui.favorites

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tivify.app.data.api.TivifyApi
import com.tivify.app.data.api.ToggleFavoriteRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FavoriteItem(
    val favoriteId: Int,
    val type: String,       // "channel" | "vod" | "series"
    val contentId: Int,
    val title: String,
    val imageUrl: String?,
    val createdAt: String?
)

data class FavoritesState(
    val favorites: List<FavoriteItem> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class FavoritesViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {
    companion object {
        private const val TAG = "FavoritesViewModel"
    }

    private val _state = MutableStateFlow(FavoritesState())
    val state: StateFlow<FavoritesState> = _state

    init {
        loadFavorites()
    }

    fun loadFavorites() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val favs = api.getFavorites(page = 1, perPage = 100).data ?: emptyList()

                // Enrich each entry with its content details concurrently with concurrency limit of 5
                val items = favs.chunked(5).flatMap { chunk ->
                    chunk.map { fav ->
                        async {
                            when (fav.favoritableType) {
                                "channel" -> {
                                    val ch = runCatching { api.getChannel(fav.favoritableId).data }.getOrNull()
                                    FavoriteItem(fav.id, "channel", fav.favoritableId,
                                        ch?.name ?: "Canal #${fav.favoritableId}",
                                        ch?.logoUrl, fav.createdAt)
                                }
                                "vod" -> {
                                    val v = runCatching { api.getVod(fav.favoritableId).data }.getOrNull()
                                    FavoriteItem(fav.id, "vod", fav.favoritableId,
                                        v?.title ?: "Pelicula #${fav.favoritableId}",
                                        v?.posterUrl, fav.createdAt)
                                }
                                "series" -> {
                                    val s = runCatching { api.getSeriesById(fav.favoritableId).data }.getOrNull()
                                    FavoriteItem(fav.id, "series", fav.favoritableId,
                                        s?.title ?: "Serie #${fav.favoritableId}",
                                        s?.posterUrl, fav.createdAt)
                                }
                                else -> FavoriteItem(fav.id, fav.favoritableType, fav.favoritableId,
                                    "#${fav.favoritableId}", null, fav.createdAt)
                            }
                        }
                    }.awaitAll()
                }

                _state.value = FavoritesState(favorites = items, isLoading = false)
            } catch (e: Exception) {
                _state.value = FavoritesState(
                    isLoading = false,
                    error = "Error cargando favoritos: ${e.localizedMessage}"
                )
            }
        }
    }

    fun removeFavorite(item: FavoriteItem) {
        viewModelScope.launch {
            try {
                api.toggleFavorite(ToggleFavoriteRequest(item.type, item.contentId))
                _state.value = _state.value.copy(
                    favorites = _state.value.favorites.filter { it.favoriteId != item.favoriteId }
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to remove favorite: ${item.favoriteId}", e)
                // Optionally update state with error, or just log it
            }
        }
    }
}
