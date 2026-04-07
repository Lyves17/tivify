package com.tivify.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material3.Icon
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import androidx.compose.ui.platform.LocalContext
import com.tivify.app.data.api.ContinueWatchingData
import com.tivify.app.ui.components.ChannelCard
import com.tivify.app.ui.components.ContentCard
import com.tivify.app.ui.components.LoadingState
import com.tivify.app.ui.components.tvFocusable
import com.tivify.app.ui.components.SkeletonChannelRow
import com.tivify.app.ui.components.SkeletonContentRow
import com.tivify.app.ui.components.SkeletonSectionHeader
import com.tivify.app.ui.components.resolveImageUrl
import com.tivify.app.BuildConfig
import com.tivify.app.ui.theme.*

@Composable
fun HomeScreen(
    onChannelClick: (Int) -> Unit,
    onVodClick: (Int) -> Unit,
    onSeriesClick: (Int) -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val screenWidthDp = LocalConfiguration.current.screenWidthDp
    val contentCardWidth = when {
        screenWidthDp > 1200 -> 200.dp  // TV
        screenWidthDp > 800 -> 170.dp   // Tablet
        else -> 130.dp                  // Phone
    }
    val channelCardWidth = when {
        screenWidthDp > 1200 -> 240.dp
        screenWidthDp > 800 -> 200.dp
        else -> 160.dp
    }

    Column(modifier = Modifier.fillMaxSize()) {
    // Title header with version
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 16.dp, top = 12.dp, end = 16.dp, bottom = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "Tivify",
            color = TextPrimary,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "v${BuildConfig.APP_VERSION}",
            color = TextMuted,
            fontSize = 12.sp
        )
    }

    LoadingState(
        isLoading = state.isLoading,
        error = state.error,
        onRetry = viewModel::loadHome,
        loadingContent = {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                item {
                    SkeletonSectionHeader()
                    Spacer(modifier = Modifier.height(8.dp))
                    SkeletonContentRow()
                }
                item {
                    SkeletonSectionHeader()
                    Spacer(modifier = Modifier.height(8.dp))
                    SkeletonChannelRow()
                }
                item {
                    SkeletonSectionHeader()
                    Spacer(modifier = Modifier.height(8.dp))
                    SkeletonContentRow()
                }
            }
        }
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Continue watching section
            if (state.continueWatching.isNotEmpty()) {
                item {
                    SectionHeader("Seguir Viendo")
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(state.continueWatching) { item ->
                            ContinueWatchingCard(
                                item = item,
                                modifier = Modifier.width(contentCardWidth),
                                onClick = { onVodClick(item.contentId) },
                                contentDescription = "Continuar viendo: ${item.contentName}"
                            )
                        }
                    }
                }
            }

            // Live channels section
            if (state.liveChannels.isNotEmpty()) {
                item {
                    SectionHeader("En Vivo", badge = "${state.liveChannels.size} canales")
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(state.liveChannels) { channel ->
                            ChannelCard(
                                name = channel.name,
                                logoUrl = channel.logoUrl,
                                isLive = true,
                                modifier = Modifier.width(channelCardWidth),
                                onClick = { onChannelClick(channel.id) }
                            )
                        }
                    }
                }
            }

            // Recent movies section
            if (state.recentVods.isNotEmpty()) {
                item {
                    SectionHeader("Peliculas Recientes")
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(state.recentVods) { vod ->
                            ContentCard(
                                title = vod.title,
                                imageUrl = vod.posterUrl,
                                subtitle = if (vod.year > 0) "${vod.year}" else null,
                                badge = if (vod.rating > 0) "%.1f".format(vod.rating) else null,
                                modifier = Modifier.width(contentCardWidth),
                                onClick = { onVodClick(vod.id) }
                            )
                        }
                    }
                }
            }

            // Recent series section
            if (state.recentSeries.isNotEmpty()) {
                item {
                    SectionHeader("Series")
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(state.recentSeries) { series ->
                            ContentCard(
                                title = series.title,
                                imageUrl = series.posterUrl,
                                subtitle = "${series.episodesCount ?: 0} episodios",
                                badge = if (series.rating > 0) "%.1f".format(series.rating) else null,
                                modifier = Modifier.width(contentCardWidth),
                                onClick = { onSeriesClick(series.id) }
                            )
                        }
                    }
                }
            }

            // Empty state
            if (state.continueWatching.isEmpty() && state.liveChannels.isEmpty() && state.recentVods.isEmpty() && state.recentSeries.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp)) {
                        Text(
                            text = "No hay contenido disponible aun.",
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                }
            }
        }
    }
    } // Column
}

@Composable
private fun ContinueWatchingCard(
    item: ContinueWatchingData,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    contentDescription: String = item.contentName
) {
    val progress = if (item.duration > 0) {
        (item.progress.toFloat() / item.duration).coerceIn(0f, 1f)
    } else 0f

    val remainingMin = if (item.duration > item.progress) {
        (item.duration - item.progress) / 60
    } else 0

    Column(
        modifier = modifier
            .tvFocusable(shape = RoundedCornerShape(8.dp))
            .clip(RoundedCornerShape(8.dp))
            .background(DarkCard)
            .clickable(onClick = onClick)
    ) {
        // Poster with progress overlay
        Box {
            SubcomposeAsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(resolveImageUrl(item.contentPoster))
                    .crossfade(true)
                    .build(),
                contentDescription = contentDescription,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(2f / 3f),
                contentScale = ContentScale.Crop,
                error = {
                    Box(
                        modifier = Modifier.fillMaxSize().background(DarkSurface),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Movie, contentDescription = "Pelicula no disponible", tint = TextMuted, modifier = Modifier.size(32.dp))
                    }
                }
            )
            // Progress bar at bottom of poster
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .align(Alignment.BottomCenter),
                color = Primary500,
                trackColor = DarkBackground.copy(alpha = 0.6f)
            )
        }
        Column(modifier = Modifier.padding(10.dp)) {
            Text(
                text = item.contentName,
                color = TextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (remainingMin > 0) {
                Text(
                    text = "${remainingMin} min restantes",
                    color = TextMuted,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, badge: String? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = title,
            color = TextPrimary,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        badge?.let {
            Text(
                text = it,
                color = Primary400,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}
