package com.tivify.app.ui.series

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.tivify.app.ui.components.*
import com.tivify.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun SeriesScreen(
    onSeriesClick: (Int) -> Unit,
    viewModel: SeriesViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val gridState = rememberLazyGridState()
    val context = LocalContext.current
    val viewModePrefs = remember { ViewModePreferences(context) }
    val viewMode by viewModePrefs.getViewMode(ScreenType.SERIES).collectAsState(initial = ViewMode.NORMAL)
    val scope = rememberCoroutineScope()
    val gridConfig = viewMode.gridConfig(ScreenType.SERIES)

    LaunchedEffect(gridState.canScrollForward) {
        if (!gridState.canScrollForward) {
            viewModel.loadMore()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Header with title + view mode selector
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Series",
                color = TextPrimary,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            ViewModeSelector(
                currentMode = viewMode,
                onModeSelected = { mode ->
                    scope.launch { viewModePrefs.setViewMode(ScreenType.SERIES, mode) }
                }
            )
        }

        TvOutlinedTextField(
            value = state.searchQuery,
            onValueChange = viewModel::search,
            placeholder = { Text("Buscar series...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted) },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
                focusedBorderColor = Primary500,
                unfocusedBorderColor = DarkBorder,
                cursorColor = Primary500,
                focusedPlaceholderColor = TextMuted,
                unfocusedPlaceholderColor = TextMuted
            )
        )

        if (state.categories.isNotEmpty()) {
            CategoryChips(
                categories = state.categories,
                selectedId = state.selectedCategoryId,
                onSelect = viewModel::selectCategory,
                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
            )
        }

        LoadingState(
            isLoading = state.isLoading && state.series.isEmpty(),
            error = state.error,
            onRetry = { viewModel.loadSeries() },
            loadingContent = { SkeletonGrid(count = 6) }
        ) {
            if (state.series.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (state.searchQuery.isNotEmpty()) "Sin resultados para \"${state.searchQuery}\"" else "No hay series disponibles",
                        color = TextSecondary
                    )
                }
            } else {
                LazyVerticalGrid(
                    columns = gridConfig.columns,
                    state = gridState,
                    contentPadding = PaddingValues(horizontal = gridConfig.contentPadding, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(gridConfig.itemSpacing),
                    verticalArrangement = Arrangement.spacedBy(gridConfig.itemSpacing)
                ) {
                    items(state.series) { series ->
                        if (viewMode == ViewMode.LIST) {
                            ContentListItem(
                                title = series.title,
                                imageUrl = series.posterUrl,
                                subtitle = "${series.episodesCount ?: 0} episodios",
                                badge = if (series.rating > 0) "%.1f".format(series.rating) else null,
                                onClick = { onSeriesClick(series.id) }
                            )
                        } else {
                            ContentCard(
                                title = series.title,
                                imageUrl = series.posterUrl,
                                subtitle = "${series.episodesCount ?: 0} episodios",
                                badge = if (series.rating > 0) "%.1f".format(series.rating) else null,
                                onClick = { onSeriesClick(series.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}
