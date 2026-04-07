package com.tivify.app.ui.channels

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.tivify.app.ui.components.*
import com.tivify.app.ui.theme.TextPrimary
import com.tivify.app.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun ChannelsScreen(
    onChannelClick: (Int) -> Unit,
    viewModel: ChannelsViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val gridState = rememberLazyGridState()
    val context = LocalContext.current
    val viewModePrefs = remember { ViewModePreferences(context) }
    val viewMode by viewModePrefs.getViewMode(ScreenType.CHANNELS).collectAsState(initial = ViewMode.NORMAL)
    val scope = rememberCoroutineScope()
    val gridConfig = viewMode.gridConfig(ScreenType.CHANNELS)

    // Infinite scroll
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
                text = "Canales",
                color = TextPrimary,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            ViewModeSelector(
                currentMode = viewMode,
                onModeSelected = { mode ->
                    scope.launch { viewModePrefs.setViewMode(ScreenType.CHANNELS, mode) }
                },
                modifier = Modifier
            )
        }

        // Category filter
        if (state.categories.isNotEmpty()) {
            CategoryChips(
                categories = state.categories,
                selectedId = state.selectedCategoryId,
                onSelect = viewModel::selectCategory,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        LoadingState(
            isLoading = state.isLoading && state.channels.isEmpty(),
            error = state.error,
            onRetry = { viewModel.loadChannels() },
            loadingContent = { SkeletonGrid(count = 6) }
        ) {
            if (state.channels.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No se encontraron canales", color = TextSecondary)
                }
            } else {
                LazyVerticalGrid(
                    columns = gridConfig.columns,
                    state = gridState,
                    contentPadding = PaddingValues(horizontal = gridConfig.contentPadding, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(gridConfig.itemSpacing),
                    verticalArrangement = Arrangement.spacedBy(gridConfig.itemSpacing)
                ) {
                    items(state.channels) { channel ->
                        if (viewMode == ViewMode.LIST) {
                            ChannelListItem(
                                name = channel.name,
                                logoUrl = channel.logoUrl,
                                isLive = channel.id in state.liveChannelIds,
                                onClick = { onChannelClick(channel.id) }
                            )
                        } else {
                            ChannelCard(
                                name = channel.name,
                                logoUrl = channel.logoUrl,
                                isLive = channel.id in state.liveChannelIds,
                                onClick = { onChannelClick(channel.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}
