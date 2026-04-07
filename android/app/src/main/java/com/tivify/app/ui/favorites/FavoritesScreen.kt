package com.tivify.app.ui.favorites

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.tivify.app.ui.components.LoadingState
import com.tivify.app.ui.components.tvFocusable
import com.tivify.app.ui.components.resolveImageUrl
import com.tivify.app.ui.theme.*

@Composable
fun FavoritesScreen(
    onChannelClick: (Int) -> Unit,
    onVodClick: (Int) -> Unit,
    onSeriesClick: (Int) -> Unit,
    onBack: () -> Unit,
    viewModel: FavoritesViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 4.dp, top = 4.dp, end = 16.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.tvFocusable(shape = RoundedCornerShape(24.dp))
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver", tint = TextPrimary)
            }
            Text(
                text = "Favoritos",
                color = TextPrimary,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
        }

        LoadingState(
            isLoading = state.isLoading,
            error = state.error,
            onRetry = viewModel::loadFavorites
        ) {
            if (state.favorites.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.FavoriteBorder,
                            contentDescription = null,
                            tint = TextMuted,
                            modifier = Modifier.size(52.dp)
                        )
                        Text("No tienes favoritos aun", color = TextSecondary)
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(state.favorites, key = { it.favoriteId }) { item ->
                        FavoriteCard(
                            item = item,
                            onClick = {
                                when (item.type) {
                                    "channel" -> onChannelClick(item.contentId)
                                    "vod"     -> onVodClick(item.contentId)
                                    "series"  -> onSeriesClick(item.contentId)
                                }
                            },
                            onRemove = { viewModel.removeFavorite(item) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FavoriteCard(item: FavoriteItem, onClick: () -> Unit, onRemove: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .tvFocusable(shape = RoundedCornerShape(10.dp))
            .clip(RoundedCornerShape(10.dp))
            .background(DarkCard)
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Thumbnail – channels are landscape, vod/series are portrait
        val isChannel = item.type == "channel"
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(DarkSurface)
                .let {
                    if (isChannel) it.size(width = 80.dp, height = 50.dp)
                    else it.size(width = 54.dp, height = 80.dp)
                },
            contentAlignment = Alignment.Center
        ) {
            if (!item.imageUrl.isNullOrEmpty()) {
                AsyncImage(
                    model = resolveImageUrl(item.imageUrl),
                    contentDescription = item.title,
                    contentScale = if (isChannel) ContentScale.Fit else ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxSize()
                        .let { if (isChannel) it.padding(6.dp) else it }
                )
            } else {
                Icon(
                    imageVector = typeIcon(item.type),
                    contentDescription = null,
                    tint = Primary400,
                    modifier = Modifier.size(28.dp)
                )
            }
        }

        // Title + badge
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(
                text = item.title,
                color = TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2
            )
            Surface(
                color = typeBadgeColor(item.type).copy(alpha = 0.15f),
                shape = RoundedCornerShape(4.dp)
            ) {
                Text(
                    text = typeLabel(item.type),
                    color = typeBadgeColor(item.type),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }

        // Remove
        IconButton(onClick = onRemove, modifier = Modifier.size(40.dp)) {
            Icon(
                Icons.Default.Delete,
                contentDescription = "Quitar de favoritos",
                tint = LiveRed.copy(alpha = 0.7f),
                modifier = Modifier.size(22.dp)
            )
        }
    }
}

private fun typeLabel(type: String) = when (type) {
    "channel" -> "Canal"
    "vod"     -> "Película"
    "series"  -> "Serie"
    else      -> type
}

private fun typeBadgeColor(type: String): Color = when (type) {
    "channel" -> LiveRed
    "vod"     -> Primary400
    "series"  -> SuccessGreen
    else      -> TextMuted
}

private fun typeIcon(type: String): ImageVector = when (type) {
    "channel" -> Icons.Default.LiveTv
    "vod"     -> Icons.Default.Movie
    "series"  -> Icons.Default.VideoLibrary
    else      -> Icons.Default.Star
}
