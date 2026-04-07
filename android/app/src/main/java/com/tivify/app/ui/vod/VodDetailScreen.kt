package com.tivify.app.ui.vod

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
class VodDetailViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {

    private val _state = MutableStateFlow(VodDetailState())
    val state: StateFlow<VodDetailState> = _state

    fun load(vodId: Int) {
        viewModelScope.launch {
            _state.value = VodDetailState(isLoading = true)
            try {
                val response = api.getVod(vodId)
                val vod = response.data

                // Fetch saved progress
                var savedProgress = 0
                var savedDuration = 0
                if (vod != null) {
                    try {
                        val continueData = api.getContinueWatching(limit = 20).data
                        val entry = continueData?.find { it.contentId == vodId }
                        if (entry != null && entry.progress > 0) {
                            savedProgress = entry.progress
                            savedDuration = entry.duration
                        }
                    } catch (_: Exception) {}
                }

                _state.value = VodDetailState(
                    vod = vod,
                    savedProgress = savedProgress,
                    savedDuration = savedDuration,
                    isLoading = false
                )
            } catch (e: Exception) {
                _state.value = VodDetailState(
                    isLoading = false,
                    error = e.localizedMessage
                )
            }
        }
    }

    fun toggleFavorite() {
        val vod = _state.value.vod ?: return
        viewModelScope.launch {
            try {
                val response = api.toggleFavorite(ToggleFavoriteRequest("vod", vod.id))
                if (response.success) {
                    _state.value = _state.value.copy(isFavorite = response.data?.added ?: false)
                }
            } catch (_: Exception) {}
        }
    }
}

private fun formatDuration(seconds: Int): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s)
    else "%d:%02d".format(m, s)
}

@Composable
fun VodDetailScreen(
    vodId: Int,
    onPlay: () -> Unit,
    onBack: () -> Unit,
    viewModel: VodDetailViewModel = androidx.hilt.navigation.compose.hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(vodId) {
        viewModel.load(vodId)
    }

    val vod = state.vod

    if (state.isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Primary500)
        }
        return
    }

    if (vod == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Error cargando pelicula", color = TextSecondary)
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        // Backdrop
        Box {
            AsyncImage(
                model = resolveImageUrl(vod.backdropUrl.ifEmpty { vod.posterUrl }),
                contentDescription = vod.title,
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

            // Back button
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

        // Info section
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = vod.title,
                color = TextPrimary,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Metadata row
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (vod.year > 0) {
                    Text("${vod.year}", color = TextSecondary, fontSize = 14.sp)
                }
                if (vod.rating > 0) {
                    Text("%.1f".format(vod.rating), color = Primary400, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
                if (vod.duration > 0) {
                    val mins = vod.duration / 60
                    Text("${mins} min", color = TextSecondary, fontSize = 14.sp)
                }
                vod.category?.let {
                    Text(it.name, color = TextMuted, fontSize = 14.sp)
                }
            }

            // Progress bar for continue watching
            if (state.savedProgress > 0 && state.savedDuration > 0) {
                Spacer(modifier = Modifier.height(12.dp))
                val progress = (state.savedProgress.toFloat() / state.savedDuration).coerceIn(0f, 1f)
                Column {
                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = Primary500,
                        trackColor = DarkBorder
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${formatDuration(state.savedProgress)} / ${formatDuration(state.savedDuration)}",
                        color = TextMuted,
                        fontSize = 12.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Action buttons
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = onPlay,
                    colors = ButtonDefaults.buttonColors(containerColor = Primary600),
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .tvFocusable(shape = RoundedCornerShape(8.dp))
                ) {
                    Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(24.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (state.savedProgress > 0) "Continuar" else "Reproducir",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }

                IconButton(
                    onClick = viewModel::toggleFavorite,
                    modifier = Modifier
                        .tvFocusable(shape = RoundedCornerShape(8.dp))
                        .clip(RoundedCornerShape(8.dp))
                        .background(DarkCard)
                        .size(48.dp)
                ) {
                    Icon(
                        imageVector = if (state.isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = "Favorito",
                        tint = if (state.isFavorite) LiveRed else TextSecondary
                    )
                }
            }

            // Description
            if (vod.description.isNotBlank()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = vod.description,
                    color = TextSecondary,
                    style = MaterialTheme.typography.bodyMedium,
                    lineHeight = 22.sp
                )
            }
        }
    }
}
