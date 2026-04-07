package com.tivify.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tivify.app.data.api.ChannelData
import com.tivify.app.data.api.ContinueWatchingData
import com.tivify.app.data.api.SeriesData
import com.tivify.app.data.api.TivifyApi
import com.tivify.app.data.api.VodData
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeState(
    val continueWatching: List<ContinueWatchingData> = emptyList(),
    val liveChannels: List<ChannelData> = emptyList(),
    val recentVods: List<VodData> = emptyList(),
    val recentSeries: List<SeriesData> = emptyList(),
    val liveChannelIds: Set<Int> = emptySet(),
    val isLoading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {

    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state

    init {
        loadHome()
    }

    fun loadHome() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                // Load continue watching
                val continueWatching = try {
                    api.getContinueWatching(limit = 10).data ?: emptyList()
                } catch (_: Exception) { emptyList() }

                // Load live channel ids
                val liveIds = try {
                    api.getLiveChannels().data?.liveChannelIds?.toSet() ?: emptySet()
                } catch (_: Exception) { emptySet() }

                // Load channels, vods, series in parallel
                val channels = try {
                    api.getChannels(page = 1, perPage = 20).data ?: emptyList()
                } catch (_: Exception) { emptyList() }

                val vods = try {
                    api.getVods(page = 1, perPage = 10).data ?: emptyList()
                } catch (_: Exception) { emptyList() }

                val series = try {
                    api.getSeries(page = 1, perPage = 10).data ?: emptyList()
                } catch (_: Exception) { emptyList() }

                // Filter live channels
                val live = if (liveIds.isNotEmpty()) {
                    channels.filter { it.id in liveIds }
                } else emptyList()

                _state.value = HomeState(
                    continueWatching = continueWatching,
                    liveChannels = live,
                    recentVods = vods,
                    recentSeries = series,
                    liveChannelIds = liveIds,
                    isLoading = false
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Error cargando contenido: ${e.localizedMessage}"
                )
            }
        }
    }
}
