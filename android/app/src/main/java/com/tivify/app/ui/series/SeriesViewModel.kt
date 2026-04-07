package com.tivify.app.ui.series

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tivify.app.data.api.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SeriesState(
    val series: List<SeriesData> = emptyList(),
    val categories: List<CategoryData> = emptyList(),
    val selectedCategoryId: Int? = null,
    val searchQuery: String = "",
    val isLoading: Boolean = true,
    val error: String? = null,
    val currentPage: Int = 1,
    val totalPages: Int = 1
)

data class SeriesDetailState(
    val series: SeriesData? = null,
    val episodes: List<VodData> = emptyList(),
    val isFavorite: Boolean = false,
    val isLoading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class SeriesViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {
    companion object {
        private const val TAG = "SeriesViewModel"
    }

    private val _state = MutableStateFlow(SeriesState())
    val state: StateFlow<SeriesState> = _state

    private var searchJob: Job? = null

    init {
        loadCategories()
        loadSeries()
    }

    private fun loadCategories() {
        viewModelScope.launch {
            try {
                val response = api.getCategories("series")
                if (response.success) {
                    _state.value = _state.value.copy(categories = response.data ?: emptyList())
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load categories", e)
            }
        }
    }

    fun loadSeries(page: Int = 1) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val s = _state.value
                val response = api.getSeries(
                    page = page,
                    perPage = 20,
                    search = s.searchQuery.ifBlank { null },
                    categoryId = s.selectedCategoryId
                )
                val newData = response.data ?: emptyList()
                _state.value = _state.value.copy(
                    series = if (page == 1) newData else _state.value.series + newData,
                    isLoading = false,
                    currentPage = response.meta.page,
                    totalPages = response.meta.pages
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Error cargando series: ${e.localizedMessage}"
                )
            }
        }
    }

    fun search(query: String) {
        _state.value = _state.value.copy(searchQuery = query)
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(400)
            loadSeries(page = 1)
        }
    }

    fun selectCategory(categoryId: Int?) {
        _state.value = _state.value.copy(selectedCategoryId = categoryId)
        loadSeries(page = 1)
    }

    fun loadMore() {
        val s = _state.value
        if (!s.isLoading && s.currentPage < s.totalPages) {
            loadSeries(s.currentPage + 1)
        }
    }
}
