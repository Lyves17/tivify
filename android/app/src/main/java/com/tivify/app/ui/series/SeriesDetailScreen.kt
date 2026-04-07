package com.tivify.app.ui.series

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.tivify.app.data.api.TivifyApi
import com.tivify.app.ui.components.resolveImageUrl
import com.tivify.app.ui.components.tvFocusable
import com.tivify.app.data.api.ToggleFavoriteRequest
import com.tivify.app.data.api.VodData
import com.tivify.app.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SeriesDetailViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {

    private val _state = MutableStateFlow(SeriesDetailState())
    val state: StateFlow<SeriesDetailState> = _state

    fun load(seriesId: Int) {
        viewModelScope.launch {
            _state.value = SeriesDetailState(isLoading = true)
            try {
                val seriesResponse = api.getSeriesById(seriesId)
                val episodesResponse = api.getEpisodes(seriesId)

                _state.value = SeriesDetailState(
                    series = seriesResponse.data,
                    episodes = episodesResponse.data ?: emptyList(),
                    isLoading = false
                )
            } catch (e: Exception) {
                _state.value = SeriesDetailState(
                    isLoading = false,
                    error = e.localizedMessage
                )
            }
        }
    }

    fun toggleFavorite() {
        val series = _state.value.series ?: return
        viewModelScope.launch {
            try {
                val response = api.toggleFavorite(ToggleFavoriteRequest("series", series.id))
                if (response.success) {
                    _state.value = _state.value.copy(isFavorite = response.data?.added ?: false)
                }
            } catch (_: Exception) {}
        }
    }
}

@Composable
fun SeriesDetailScreen(
    seriesId: Int,
    onEpisodePlay: (Int) -> Unit,
    onBack: () -> Unit,
    viewModel: SeriesDetailViewModel = androidx.hilt.navigation.compose.hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(seriesId) {
        viewModel.load(seriesId)
    }

    if (state.isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Primary500)
        }
        return
    }

    val series = state.series
    if (series == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Error cargando serie", color = TextSecondary)
        }
        return
    }

    // Group episodes by season
    val episodesBySeason = state.episodes
        .groupBy { it.seasonNumber }
        .toSortedMap()

    var selectedSeason by remember {
        mutableIntStateOf(episodesBySeason.keys.firstOrNull() ?: 1)
    }

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        // Backdrop
        item {
            Box {
                AsyncImage(
                    model = resolveImageUrl(series.backdropUrl.ifEmpty { series.posterUrl }),
                    contentDescription = series.title,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(16f / 9f),
                    contentScale = ContentScale.Crop
                )

                // Top gradient overlay for back button visibility
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(80.dp)
                        .align(Alignment.TopCenter)
                        .background(
                            brush = androidx.compose.ui.graphics.Brush.verticalGradient(
                                colors = listOf(
                                    DarkBackground.copy(alpha = 0.7f),
                                    DarkBackground.copy(alpha = 0f)
                                )
                            )
                        )
                )

                IconButton(
                    onClick = onBack,
                    modifier = Modifier
                        .padding(8.dp)
                        .tvFocusable(shape = RoundedCornerShape(24.dp))
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Volver",
                        tint = TextPrimary
                    )
                }

                // Bottom gradient overlay
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(80.dp)
                        .align(Alignment.BottomCenter)
                        .background(
                            brush = androidx.compose.ui.graphics.Brush.verticalGradient(
                                colors = listOf(
                                    DarkBackground.copy(alpha = 0f),
                                    DarkBackground
                                )
                            )
                        )
                )
            }
        }

        // Series info
        item {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = series.title,
                        color = TextPrimary,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )

                    IconButton(onClick = viewModel::toggleFavorite) {
                        Icon(
                            imageVector = if (state.isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = "Favorito",
                            tint = if (state.isFavorite) LiveRed else TextSecondary
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (series.year > 0) Text("${series.year}", color = TextSecondary, fontSize = 14.sp)
                    if (series.rating > 0) Text("%.1f".format(series.rating), color = Primary400, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Text("${series.totalSeasons} temporadas", color = TextSecondary, fontSize = 14.sp)
                }

                if (series.description.isNotBlank()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(series.description, color = TextSecondary, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        // Season selector (scrollable for many seasons)
        if (episodesBySeason.size > 1) {
            item {
                LazyRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(episodesBySeason.keys.toList()) { season ->
                        var chipFocused by remember { mutableStateOf(false) }
                        FilterChip(
                            selected = selectedSeason == season,
                            onClick = { selectedSeason = season },
                            label = { Text("T$season") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Primary600,
                                selectedLabelColor = TextPrimary,
                                containerColor = DarkCard,
                                labelColor = TextSecondary
                            ),
                            modifier = Modifier
                                .onFocusChanged { chipFocused = it.isFocused }
                                .then(
                                    if (chipFocused) Modifier.border(2.dp, Primary500, RoundedCornerShape(8.dp))
                                    else Modifier
                                )
                                .focusable()
                        )
                    }
                }
            }
        }

        // Episode header
        item {
            Text(
                text = "Episodios",
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
        }

        // Episodes list
        val seasonEpisodes = episodesBySeason[selectedSeason] ?: emptyList()
        items(seasonEpisodes.sortedBy { it.episodeNumber }) { episode ->
            EpisodeRow(
                episode = episode,
                onClick = { onEpisodePlay(episode.id) }
            )
        }
    }
}

@Composable
private fun EpisodeRow(episode: VodData, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .tvFocusable(shape = RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Episode number
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(DarkCard),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "${episode.episodeNumber}",
                color = Primary400,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
        }

        // Episode info
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = episode.title,
                color = TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold
            )
            if (episode.duration > 0) {
                Text(
                    text = "${episode.duration / 60} min",
                    color = TextMuted,
                    fontSize = 14.sp
                )
            }
        }

        // Play icon
        Icon(
            Icons.Default.PlayArrow,
            contentDescription = "Reproducir",
            tint = Primary400,
            modifier = Modifier.size(28.dp)
        )
    }
}
