package com.tivify.app.ui.vod

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tivify.app.data.api.CategoryData
import com.tivify.app.data.api.TivifyApi
import com.tivify.app.data.api.VodData
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class VodState(
    val vods: List<VodData> = emptyList(),
    val categories: List<CategoryData> = emptyList(),
    val selectedCategoryId: Int? = null,
    val searchQuery: String = "",
    val isLoading: Boolean = true,
    val error: String? = null,
    val currentPage: Int = 1,
    val totalPages: Int = 1
)

data class VodDetailState(
    val vod: VodData? = null,
    val isFavorite: Boolean = false,
    val savedProgress: Int = 0,
    val savedDuration: Int = 0,
    val isLoading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class VodViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {
    companion object {
        private const val TAG = "VodViewModel"
    }

    private val _state = MutableStateFlow(VodState())
    val state: StateFlow<VodState> = _state

    private var searchJob: Job? = null

    init {
        loadCategories()
        loadVods()
    }

    private fun loadCategories() {
        viewModelScope.launch {
            try {
                val response = api.getCategories("vod")
                if (response.success) {
                    _state.value = _state.value.copy(categories = response.data ?: emptyList())
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load categories", e)
            }
        }
    }

    fun loadVods(page: Int = 1) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val s = _state.value
                val response = api.getVods(
                    page = page,
                    perPage = 20,
                    search = s.searchQuery.ifBlank { null },
                    categoryId = s.selectedCategoryId
                )
                val newData = response.data ?: emptyList()
                _state.value = _state.value.copy(
                    vods = if (page == 1) newData else _state.value.vods + newData,
                    isLoading = false,
                    currentPage = response.meta.page,
                    totalPages = response.meta.pages
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Error cargando peliculas: ${e.localizedMessage}"
                )
            }
        }
    }

    fun search(query: String) {
        _state.value = _state.value.copy(searchQuery = query)
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(400)
            loadVods(page = 1)
        }
    }

    fun selectCategory(categoryId: Int?) {
        _state.value = _state.value.copy(selectedCategoryId = categoryId)
        loadVods(page = 1)
    }

    fun loadMore() {
        val s = _state.value
        if (!s.isLoading && s.currentPage < s.totalPages) {
            loadVods(s.currentPage + 1)
        }
    }
}
