package com.tivify.app.ui.epg

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tivify.app.data.api.ChannelData
import com.tivify.app.data.api.EpgEntry
import com.tivify.app.data.api.TivifyApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

data class EpgState(
    val channels: List<ChannelData> = emptyList(),
    val entries: List<EpgEntry> = emptyList(),
    val selectedChannelId: Int? = null,
    val selectedDate: LocalDate = LocalDate.now(),
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class EpgViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {
    companion object {
        private const val TAG = "EpgViewModel"
    }

    private val _state = MutableStateFlow(EpgState())
    val state: StateFlow<EpgState> = _state

    init {
        loadChannels()
    }

    private fun loadChannels() {
        viewModelScope.launch {
            try {
                val response = api.getChannels(page = 1, perPage = 100)
                val channels = response.data ?: emptyList()
                _state.value = _state.value.copy(channels = channels)
                if (channels.isNotEmpty() && _state.value.selectedChannelId == null) {
                    selectChannel(channels.first().id)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load channels", e)
            }
        }
    }

    fun selectChannel(channelId: Int) {
        _state.value = _state.value.copy(selectedChannelId = channelId)
        loadEpg()
    }

    fun selectDate(date: LocalDate) {
        _state.value = _state.value.copy(selectedDate = date)
        loadEpg()
    }

    private fun loadEpg() {
        val channelId = _state.value.selectedChannelId ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val dateStr = _state.value.selectedDate.format(DateTimeFormatter.ISO_LOCAL_DATE)
                val response = api.getEpg(channelId, dateStr)
                _state.value = _state.value.copy(
                    entries = response.data ?: emptyList(),
                    isLoading = false
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Error cargando EPG: ${e.localizedMessage}"
                )
            }
        }
    }
}
