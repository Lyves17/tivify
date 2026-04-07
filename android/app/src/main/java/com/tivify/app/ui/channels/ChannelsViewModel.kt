package com.tivify.app.ui.channels

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tivify.app.data.api.CategoryData
import com.tivify.app.data.api.ChannelData
import com.tivify.app.data.api.TivifyApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChannelsState(
    val channels: List<ChannelData> = emptyList(),
    val categories: List<CategoryData> = emptyList(),
    val liveChannelIds: Set<Int> = emptySet(),
    val selectedCategoryId: Int? = null,
    val isLoading: Boolean = true,
    val error: String? = null,
    val currentPage: Int = 1,
    val totalPages: Int = 1
)

@HiltViewModel
class ChannelsViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {
    companion object {
        private const val TAG = "ChannelsViewModel"
    }

    private val _state = MutableStateFlow(ChannelsState())
    val state: StateFlow<ChannelsState> = _state

    init {
        loadCategories()
        loadChannels()
        loadLiveChannels()
    }

    private fun loadCategories() {
        viewModelScope.launch {
            try {
                val response = api.getCategories("live")
                if (response.success) {
                    _state.value = _state.value.copy(categories = response.data ?: emptyList())
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load categories", e)
            }
        }
    }

    private fun loadLiveChannels() {
        viewModelScope.launch {
            try {
                val response = api.getLiveChannels()
                if (response.success) {
                    _state.value = _state.value.copy(
                        liveChannelIds = response.data?.liveChannelIds?.toSet() ?: emptySet()
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load live channels", e)
            }
        }
    }

    fun loadChannels(page: Int = 1) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val response = api.getChannels(
                    page = page,
                    perPage = 50,
                    categoryId = _state.value.selectedCategoryId
                )
                val newData = response.data ?: emptyList()
                _state.value = _state.value.copy(
                    channels = if (page == 1) newData else _state.value.channels + newData,
                    isLoading = false,
                    currentPage = response.meta.page,
                    totalPages = response.meta.pages
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Error cargando canales: ${e.localizedMessage}"
                )
            }
        }
    }

    fun selectCategory(categoryId: Int?) {
        _state.value = _state.value.copy(selectedCategoryId = categoryId)
        loadChannels(page = 1)
    }

    fun loadMore() {
        val s = _state.value
        // Only load more if not already loading, have more pages, and have channels to show
        if (!s.isLoading && s.channels.isNotEmpty() && s.currentPage < s.totalPages) {
            loadChannels(s.currentPage + 1)
        }
    }
}
