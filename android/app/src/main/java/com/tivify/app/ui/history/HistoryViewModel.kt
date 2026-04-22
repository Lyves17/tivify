package com.tivify.app.ui.history

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tivify.app.data.api.TivifyApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HistoryItem(
    val historyId: Int,
    val type: String,       // "vod" | "channel"
    val contentId: Int,
    val title: String,
    val posterUrl: String?,
    val progress: Int,      // seconds watched
    val duration: Int,      // total seconds
    val watchedAt: String
) {
    /** 0.0 – 1.0 fraction of content already watched. */
    val progressFraction: Float
        get() = if (duration > 0) (progress.toFloat() / duration).coerceIn(0f, 1f) else 0f
}

data class HistoryState(
    val history: List<HistoryItem> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class HistoryViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {
    companion object {
        private const val TAG = "HistoryViewModel"
    }

    private val _state = MutableStateFlow(HistoryState())
    val state: StateFlow<HistoryState> = _state

    init {
        loadHistory()
    }

    fun loadHistory() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val entries = api.getHistory(page = 1, perPage = 50).data ?: emptyList()

                // Enrich each entry with its content details concurrently with concurrency limit of 5
                val items = entries.chunked(5).flatMap { chunk ->
                    chunk.map { entry ->
                        async {
                            when (entry.contentType) {
                                "channel" -> {
                                    val ch = runCatching { api.getChannel(entry.contentId).data }
                                        .onFailure { if (it is CancellationException) throw it }
                                        .getOrNull()
                                    HistoryItem(entry.id, "channel", entry.contentId,
                                        ch?.name ?: "Canal #${entry.contentId}",
                                        ch?.logoUrl,
                                        entry.progress, entry.duration, entry.watchedAt)
                                }
                                else -> {
                                    // vod (episode or movie)
                                    val v = runCatching { api.getVod(entry.contentId).data }
                                        .onFailure { if (it is CancellationException) throw it }
                                        .getOrNull()
                                    HistoryItem(entry.id, "vod", entry.contentId,
                                        v?.title ?: "Contenido #${entry.contentId}",
                                        v?.posterUrl,
                                        entry.progress, entry.duration, entry.watchedAt)
                                }
                            }
                        }
                    }.awaitAll()
                }

                _state.value = HistoryState(history = items, isLoading = false)
            } catch (e: CancellationException) {
                // Never swallow cancellation — propagate so the parent scope
                // (viewModelScope) can clean up correctly.
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load history", e)
                _state.value = HistoryState(
                    isLoading = false,
                    error = "Error cargando historial: ${e.localizedMessage ?: e.javaClass.simpleName}"
                )
            }
        }
    }

    fun deleteEntry(historyId: Int) {
        viewModelScope.launch {
            try {
                api.deleteHistory(historyId)
                _state.value = _state.value.copy(
                    history = _state.value.history.filter { it.historyId != historyId }
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Failed to delete history entry: $historyId", e)
            }
        }
    }
}
