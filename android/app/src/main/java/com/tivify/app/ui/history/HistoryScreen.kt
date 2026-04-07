package com.tivify.app.ui.history

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
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun HistoryScreen(
    onChannelClick: (Int) -> Unit,
    onVodClick: (Int) -> Unit,
    onBack: () -> Unit,
    viewModel: HistoryViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        // Top bar
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
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Volver",
                    tint = TextPrimary
                )
            }
            Text(
                text = "Historial",
                color = TextPrimary,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
        }

        LoadingState(
            isLoading = state.isLoading,
            error = state.error,
            onRetry = viewModel::loadHistory
        ) {
            if (state.history.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.History,
                            contentDescription = null,
                            tint = TextMuted,
                            modifier = Modifier.size(52.dp)
                        )
                        Text("Sin historial de reproduccion", color = TextSecondary)
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(state.history, key = { it.historyId }) { item ->
                        HistoryCard(
                            item = item,
                            onClick = {
                                if (item.type == "channel") onChannelClick(item.contentId)
                                else onVodClick(item.contentId)
                            },
                            onDelete = { viewModel.deleteEntry(item.historyId) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryCard(item: HistoryItem, onClick: () -> Unit, onDelete: () -> Unit) {
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
        // Poster thumbnail
        Box(
            modifier = Modifier
                .size(width = 62.dp, height = 90.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(DarkSurface),
            contentAlignment = Alignment.Center
        ) {
            if (!item.posterUrl.isNullOrEmpty()) {
                AsyncImage(
                    model = resolveImageUrl(item.posterUrl),
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Icon(
                    imageVector = if (item.type == "channel") Icons.Default.LiveTv else Icons.Default.Movie,
                    contentDescription = null,
                    tint = Primary400,
                    modifier = Modifier.size(28.dp)
                )
            }
        }

        // Info column
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Text(
                text = item.title,
                color = TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2
            )
            Text(
                text = formatWatchedAt(item.watchedAt),
                color = TextMuted,
                fontSize = 14.sp
            )

            // Progress bar (meaningful only for VOD)
            if (item.type != "channel" && item.duration > 0) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    LinearProgressIndicator(
                        progress = { item.progressFraction },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = Primary500,
                        trackColor = DarkBorder
                    )
                    Text(
                        text = "${(item.progressFraction * 100).toInt()}% visto · ${formatDuration(item.progress)} / ${formatDuration(item.duration)}",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                }
            }
        }

        // Delete button
        IconButton(onClick = onDelete, modifier = Modifier.size(40.dp)) {
            Icon(
                Icons.Default.Delete,
                contentDescription = "Eliminar del historial",
                tint = TextMuted.copy(alpha = 0.7f),
                modifier = Modifier.size(22.dp)
            )
        }
    }
}

private fun formatWatchedAt(iso: String): String = try {
    val instant = Instant.parse(iso)
    val diffSec = Instant.now().epochSecond - instant.epochSecond
    when {
        diffSec < 3600  -> "Hace ${diffSec / 60} min"
        diffSec < 86400 -> "Hace ${diffSec / 3600}h"
        diffSec < 604800 -> "Hace ${diffSec / 86400}d"
        else -> DateTimeFormatter.ofPattern("dd/MM/yyyy")
            .withZone(ZoneId.systemDefault())
            .format(instant)
    }
} catch (_: Exception) { iso }

private fun formatDuration(seconds: Int): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}
