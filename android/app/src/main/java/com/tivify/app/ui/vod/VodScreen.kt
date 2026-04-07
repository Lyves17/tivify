package com.tivify.app.ui.vod

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
import com.tivify.app.ui.components.TvOutlinedTextField
import com.tivify.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun VodScreen(
    onVodClick: (Int) -> Unit,
    viewModel: VodViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val gridState = rememberLazyGridState()
    val context = LocalContext.current
    val viewModePrefs = remember { ViewModePreferences(context) }
    val viewMode by viewModePrefs.getViewMode(ScreenType.VOD).collectAsState(initial = ViewMode.NORMAL)
    val scope = rememberCoroutineScope()
    val gridConfig = viewMode.gridConfig(ScreenType.VOD)

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
                text = "Peliculas",
                color = TextPrimary,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            ViewModeSelector(
                currentMode = viewMode,
                onModeSelected = { mode ->
                    scope.launch { viewModePrefs.setViewMode(ScreenType.VOD, mode) }
                }
            )
        }

        // Search bar
        TvOutlinedTextField(
            value = state.searchQuery,
            onValueChange = viewModel::search,
            placeholder = { Text("Buscar peliculas...") },
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

        // Category filter
        if (state.categories.isNotEmpty()) {
            CategoryChips(
                categories = state.categories,
                selectedId = state.selectedCategoryId,
                onSelect = viewModel::selectCategory,
                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
            )
        }

        LoadingState(
            isLoading = state.isLoading && state.vods.isEmpty(),
            error = state.error,
            onRetry = { viewModel.loadVods() },
            loadingContent = { SkeletonGrid(count = 6) }
        ) {
            if (state.vods.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (state.searchQuery.isNotEmpty()) "Sin resultados para \"${state.searchQuery}\"" else "No hay peliculas disponibles",
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
                    items(state.vods) { vod ->
                        if (viewMode == ViewMode.LIST) {
                            ContentListItem(
                                title = vod.title,
                                imageUrl = vod.posterUrl,
                                subtitle = if (vod.year > 0) "${vod.year}" else null,
                                badge = if (vod.rating > 0) "%.1f".format(vod.rating) else null,
                                onClick = { onVodClick(vod.id) }
                            )
                        } else {
                            ContentCard(
                                title = vod.title,
                                imageUrl = vod.posterUrl,
                                subtitle = if (vod.year > 0) "${vod.year}" else null,
                                badge = if (vod.rating > 0) "%.1f".format(vod.rating) else null,
                                onClick = { onVodClick(vod.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}
