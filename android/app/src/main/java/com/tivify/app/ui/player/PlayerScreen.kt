package com.tivify.app.ui.player

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.pm.ActivityInfo
import android.os.Build
import android.util.Log
import android.util.Rational
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.tivify.app.MainActivity
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.tivify.app.BuildConfig
import com.tivify.app.R
import com.tivify.app.data.TokenManager
import com.tivify.app.data.api.RecordHistoryRequest
import com.tivify.app.data.api.TivifyApi
import com.tivify.app.ui.components.tvFocusable
import com.tivify.app.ui.theme.DarkBackground
import com.tivify.app.ui.theme.LiveRed
import com.tivify.app.ui.theme.Primary400
import com.tivify.app.ui.theme.Primary500
import com.tivify.app.ui.theme.Primary600
import com.tivify.app.ui.theme.TextMuted
import com.tivify.app.ui.theme.TextPrimary
import com.tivify.app.ui.theme.TextSecondary
import com.tivify.app.util.TimeUtil
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class PlayerState(
    val streamUrl: String? = null,
    val token: String? = null,
    val debugInfo: String = "",
    val isLoading: Boolean = true,
    val error: String? = null,
    val playerError: String? = null,
    val contentType: String = "",
    val contentId: Int = 0,
    val savedProgressMs: Long = 0L,
    val contentTitle: String = "",
    val contentSubtitle: String = "",
    val contentYear: String = "",
    val isLiveChannel: Boolean = false,
    val currentEpgTitle: String = "",
    val currentEpgProgress: Float = 0f,
    val epgStartTime: String = "",
    val epgEndTime: String = "",
    val seriesId: Int? = null
)

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val api: TivifyApi,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _state = MutableStateFlow(PlayerState())
    val state: StateFlow<PlayerState> = _state

    fun load(type: String, id: Int) {
        _state.value = PlayerState(isLoading = true, contentType = type, contentId = id)
        viewModelScope.launch {
            try {
                val serverUrl = tokenManager.getServerUrl().firstOrNull()?.trimEnd('/') ?: ""
                val token = tokenManager.getToken().firstOrNull() ?: ""
                val debug = StringBuilder("serverUrl=$serverUrl\ntype=$type id=$id\nhasToken=${token.isNotEmpty()}\n")

                // For VOD content, fetch saved progress
                var savedProgressMs = 0L
                if (type == "vod") {
                    try {
                        val continueData = api.getContinueWatching(limit = 20).data
                        val entry = continueData?.find { it.contentId == id }
                        if (entry != null && entry.progress > 0) {
                            savedProgressMs = entry.progress.toLong() * 1000L
                            debug.append("savedProgress=${entry.progress}s\n")
                        }
                    } catch (_: Exception) {
                        debug.append("savedProgress=error fetching\n")
                    }
                }

                when (type) {
                    "channel" -> {
                        val response = api.getChannel(id)
                        val channel = response.data
                        debug.append("channel=${channel?.name}\n")
                        debug.append("totalStreams=${channel?.streams?.size ?: 0}\n")
                        channel?.streams?.forEachIndexed { i, s ->
                            debug.append("  stream[$i] url=${s.url} format=${s.streamFormat} active=${s.isActive} priority=${s.priority}\n")
                        }

                        if (channel != null) {
                            val streams = channel.streams?.filter { it.isActive }?.sortedByDescending { it.priority }
                            val stream = streams?.firstOrNull { it.streamFormat == "hls" }
                                ?: streams?.firstOrNull()

                            debug.append("selectedStream=${stream?.url} format=${stream?.streamFormat}\n")

                            if (stream != null) {
                                val url = if (stream.url.startsWith("http")) stream.url
                                else "$serverUrl${stream.url}"
                                debug.append("finalUrl=$url")

                                // Fetch current EPG program
                                var epgTitle = ""
                                var epgProgress = 0f
                                var epgStartTime = ""
                                var epgEndTime = ""
                                try {
                                    val epgResponse = api.getEpg(id)
                                    val epgList = epgResponse.data ?: emptyList()
                                    val now = System.currentTimeMillis()
                                    val currentProgram = epgList.find { entry ->
                                        try {
                                            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                                            val startTime = sdf.parse(entry.startTime)?.time ?: return@find false
                                            val endTime = sdf.parse(entry.endTime)?.time ?: return@find false
                                            now in startTime..endTime
                                        } catch (_: Exception) {
                                            false
                                        }
                                    }
                                    if (currentProgram != null) {
                                        epgTitle = currentProgram.title
                                        epgStartTime = currentProgram.startTime
                                        epgEndTime = currentProgram.endTime
                                        try {
                                            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                                            val start = sdf.parse(epgStartTime)?.time ?: 0L
                                            val end = sdf.parse(epgEndTime)?.time ?: 0L
                                            if (end > start) {
                                                epgProgress = ((now - start).toFloat() / (end - start)).coerceIn(0f, 1f)
                                            }
                                        } catch (_: Exception) {}
                                    }
                                } catch (_: Exception) {
                                    debug.append("\nepg=error fetching")
                                }

                                _state.value = _state.value.copy(
                                    streamUrl = url,
                                    token = token,
                                    isLoading = false,
                                    debugInfo = debug.toString(),
                                    contentTitle = channel.name,
                                    contentSubtitle = epgTitle,
                                    isLiveChannel = true,
                                    currentEpgTitle = epgTitle,
                                    currentEpgProgress = epgProgress,
                                    epgStartTime = epgStartTime,
                                    epgEndTime = epgEndTime
                                )
                            } else {
                                debug.append("ERROR: no active streams found")
                                _state.value = _state.value.copy(isLoading = false, error = "Sin streams activos\n\nTodos los streams:\n${channel.streams?.joinToString("\n") { "${it.url} [${it.streamFormat}] active=${it.isActive}" }}", debugInfo = debug.toString())
                            }
                        } else {
                            debug.append("ERROR: channel not found, success=${response.success} msg=${response.message}")
                            _state.value = _state.value.copy(isLoading = false, error = "Canal no encontrado", debugInfo = debug.toString())
                        }
                    }
                    "vod" -> {
                        val response = api.getVod(id)
                        val vod = response.data
                        debug.append("vod=${vod?.title}\nhlsPath=${vod?.hlsPath}\ndirectPlayPath=${vod?.directPlayPath}\ntranscode=${vod?.transcodeStatus}\n")

                        if (vod != null) {
                            val url = when {
                                !vod.directPlayPath.isNullOrEmpty() -> "$serverUrl${vod.directPlayPath}"
                                vod.hlsPath.isNotEmpty() -> "$serverUrl${vod.hlsPath}"
                                else -> null
                            }
                            debug.append("finalUrl=$url")
                            if (url != null) {
                                // Build subtitle for VOD
                                val subtitle = if (vod.seriesId != null) {
                                    "S${vod.seasonNumber}:E${vod.episodeNumber}"
                                } else {
                                    vod.year.toString()
                                }

                                _state.value = _state.value.copy(
                                    streamUrl = url,
                                    token = token,
                                    isLoading = false,
                                    debugInfo = debug.toString(),
                                    contentTitle = vod.title,
                                    contentSubtitle = subtitle,
                                    contentYear = vod.year.toString(),
                                    isLiveChannel = false,
                                    savedProgressMs = savedProgressMs,
                                    seriesId = vod.seriesId
                                )
                            } else {
                                _state.value = _state.value.copy(isLoading = false, error = "Sin fuente de video (hlsPath y directPlayPath vacios)", debugInfo = debug.toString())
                            }
                        } else {
                            _state.value = _state.value.copy(isLoading = false, error = "Video no encontrado", debugInfo = debug.toString())
                        }
                    }
                    else -> {
                        _state.value = _state.value.copy(isLoading = false, error = "Tipo no soportado: $type")
                    }
                }
            } catch (e: Exception) {
                Log.e("PlayerViewModel", "Error loading player content", e)
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Error API: ${e.javaClass.simpleName}: ${e.localizedMessage}"
                )
            }
        }
    }

    fun setPlayerError(error: String) {
        _state.value = _state.value.copy(playerError = error)
    }

    fun recordProgress(progressMs: Long, durationMs: Long) {
        val s = _state.value
        if (s.contentType != "vod" || durationMs <= 0) return
        viewModelScope.launch {
            try {
                api.recordHistory(
                    RecordHistoryRequest(
                        contentType = s.contentType,
                        contentId = s.contentId,
                        progress = (progressMs / 1000).toInt(),
                        duration = (durationMs / 1000).toInt()
                    )
                )
            } catch (e: Exception) {
                Log.w("PlayerViewModel", "Failed to record progress", e)
            }
        }
    }
}


@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(
    contentType: String?,
    contentId: Int?,
    onBack: () -> Unit,
    viewModel: PlayerViewModel = androidx.hilt.navigation.compose.hiltViewModel()
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Use default values if navigation arguments are missing
    val type = contentType ?: "channel"
    val id = contentId ?: 0

    DisposableEffect(Unit) {
        val activity = context as? Activity
        val originalOrientation = activity?.requestedOrientation
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        // Register PiP flag
        (activity as? MainActivity)?.isInPlayerScreen = true
        onDispose {
            activity?.requestedOrientation = originalOrientation ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            (activity as? MainActivity)?.isInPlayerScreen = false
        }
    }

    LaunchedEffect(type, id) {
        if (id > 0) {
            viewModel.load(type, id)
        } else {
            viewModel.setPlayerError("ContentId is missing or invalid")
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        when {
            state.isLoading -> {
                CircularProgressIndicator(color = Primary500, modifier = Modifier.align(Alignment.Center))
            }
            state.error != null -> {
                DebugErrorPanel(
                    error = state.error!!,
                    debugInfo = state.debugInfo,
                    onBack = onBack
                )
            }
            state.streamUrl != null -> {
                VideoPlayer(
                    url = state.streamUrl!!,
                    token = state.token,
                    debugInfo = state.debugInfo,
                    savedProgressMs = state.savedProgressMs,
                    contentType = state.contentType,
                    contentTitle = state.contentTitle,
                    contentSubtitle = state.contentSubtitle,
                    contentYear = state.contentYear,
                    isLiveChannel = state.isLiveChannel,
                    currentEpgTitle = state.currentEpgTitle,
                    currentEpgProgress = state.currentEpgProgress,
                    seriesId = state.seriesId,
                    onBack = onBack,
                    onProgress = { pos, dur -> viewModel.recordProgress(pos, dur) },
                    onPlayerError = { viewModel.setPlayerError(it) },
                    onResumed = { progressSec ->
                        val formatted = TimeUtil.formatDuration(progressSec)
                        snackbarHostState.currentSnackbarData?.dismiss()
                        snackbarHostState.showSnackbar(
                            message = "Reanudando desde $formatted",
                            duration = SnackbarDuration.Short
                        )
                    }
                )
                // Show player error overlay if ExoPlayer fails
                state.playerError?.let { err ->
                    DebugErrorPanel(
                        error = "ExoPlayer error: $err",
                        debugInfo = state.debugInfo,
                        onBack = onBack
                    )
                }
            }
        }

        // Snackbar host for resume notification
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 80.dp)
        ) { data ->
            androidx.compose.material3.Snackbar(
                snackbarData = data,
                containerColor = Primary600,
                contentColor = TextPrimary
            )
        }
    }
}

@Composable
private fun DebugErrorPanel(error: String, debugInfo: String, onBack: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.player_back), tint = TextPrimary)
        }

        Text("ERROR DE REPRODUCCION", color = LiveRed, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text(error, color = LiveRed, fontSize = 13.sp)

        // Only show debug info in debug builds
        if (BuildConfig.DEBUG && debugInfo.isNotEmpty()) {
            HorizontalDivider(color = DarkBackground)
            Text("DEBUG INFO:", color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text(debugInfo, color = TextSecondary, fontSize = 11.sp, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
        }
    }
}

@UnstableApi
@Composable
private fun VideoPlayer(
    url: String,
    token: String?,
    debugInfo: String,
    savedProgressMs: Long,
    contentType: String,
    contentTitle: String,
    contentSubtitle: String,
    contentYear: String,
    isLiveChannel: Boolean,
    currentEpgTitle: String,
    currentEpgProgress: Float,
    seriesId: Int?,
    onBack: () -> Unit,
    onProgress: (Long, Long) -> Unit,
    onPlayerError: (String) -> Unit,
    onResumed: suspend (Long) -> Unit
) {
    val context = LocalContext.current
    var showDebug by remember { mutableStateOf(false) }
    var hasResumed by remember { mutableStateOf(false) }

    // Create and manage ExoPlayer lifecycle safely
    val player = remember {
        mutableStateOf<ExoPlayer?>(null)
    }

    DisposableEffect(url, token) {
        // Create player on first composition or when url/token change
        val dataSourceFactory = DefaultHttpDataSource.Factory().apply {
            if (!token.isNullOrEmpty()) {
                setDefaultRequestProperties(mapOf("Authorization" to "Bearer $token"))
            }
            setConnectTimeoutMs(15_000)
            setReadTimeoutMs(15_000)
            setAllowCrossProtocolRedirects(true)
        }

        val mediaItem = MediaItem.fromUri(url)
        val mediaSource = when {
            url.contains(".m3u8") ->
                HlsMediaSource.Factory(dataSourceFactory).createMediaSource(mediaItem)
            else ->
                ProgressiveMediaSource.Factory(dataSourceFactory).createMediaSource(mediaItem)
        }

        val newPlayer = ExoPlayer.Builder(context).build().apply {
            setMediaSource(mediaSource)
            prepare()
            playWhenReady = true
        }
        player.value = newPlayer

        // Setup listener
        val listener = object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                val msg = "code=${error.errorCode} cause=${error.cause?.javaClass?.simpleName}: ${error.cause?.message}"
                Log.e("PlayerScreen", "ExoPlayer error: $msg", error)
                onPlayerError(msg)
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED || playbackState == Player.STATE_IDLE) {
                    onProgress(newPlayer.currentPosition, newPlayer.duration)
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (!isPlaying && newPlayer.currentPosition > 0) {
                    onProgress(newPlayer.currentPosition, newPlayer.duration)
                }
            }
        }
        newPlayer.addListener(listener)

        // Cleanup on dispose
        onDispose {
            onProgress(newPlayer.currentPosition, newPlayer.duration)
            newPlayer.removeListener(listener)
            newPlayer.release()
            player.value = null
        }
    }

    // Seek to saved position once player is ready
    LaunchedEffect(player.value, savedProgressMs) {
        val currentPlayer = player.value ?: return@LaunchedEffect
        if (savedProgressMs > 0 && !hasResumed) {
            // Wait for player to be ready before seeking
            var attempts = 0
            while (currentPlayer.playbackState != Player.STATE_READY && currentPlayer.playbackState != Player.STATE_ENDED && attempts < 100) {
                delay(100)
                attempts++
            }
            if (currentPlayer.playbackState == Player.STATE_READY) {
                currentPlayer.seekTo(savedProgressMs)
                hasResumed = true
                onResumed(savedProgressMs / 1000)
            }
        }
    }

    var controlsVisible by remember { mutableStateOf(true) }
    var playerViewRef by remember { mutableStateOf<PlayerView?>(null) }
    var showCenterPlayIcon by remember { mutableStateOf(false) }
    var isPlaying by remember { mutableStateOf(true) }
    var currentPositionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var focusedButton by remember { mutableIntStateOf(0) } // 0=progress, 1=play, 2=back, 3=forward, 4=audio, 5=episodes, 6=speed
    val focusRequester = remember { FocusRequester() }
    var hideControlsJob by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }

    // Speed control
    val speedOptions = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f)
    var currentSpeed by remember { mutableStateOf(1f) }
    var showSpeedMenu by remember { mutableStateOf(false) }

    // Subtitle tracks
    var showSubtitleMenu by remember { mutableStateOf(false) }
    var subtitleTracks by remember { mutableStateOf<List<Pair<Int, String>>>(emptyList()) }
    var selectedSubtitleIndex by remember { mutableIntStateOf(-1) }

    // Quality tracks
    var showQualityMenu by remember { mutableStateOf(false) }
    var qualityTracks by remember { mutableStateOf<List<Pair<Int, String>>>(emptyList()) }
    var selectedQualityIndex by remember { mutableIntStateOf(-1) }

    // Progress update loop
    LaunchedEffect(player.value) {
        player.value?.let { exoPlayer ->
            while (true) {
                delay(500)
                currentPositionMs = exoPlayer.currentPosition
                durationMs = exoPlayer.duration
                isPlaying = exoPlayer.isPlaying
            }
        }
    }

    // Track available subtitle/quality tracks
    LaunchedEffect(player.value) {
        val exoPlayer = player.value ?: return@LaunchedEffect
        val tracksListener = object : Player.Listener {
            override fun onTracksChanged(tracks: Tracks) {
                val subs = mutableListOf<Pair<Int, String>>()
                val quals = mutableListOf<Pair<Int, String>>()

                for (group in tracks.groups) {
                    val trackGroup = group.mediaTrackGroup
                    for (i in 0 until trackGroup.length) {
                        val format = trackGroup.getFormat(i)
                        when (trackGroup.type) {
                            C.TRACK_TYPE_TEXT -> {
                                val label = format.label ?: format.language ?: "Track ${subs.size + 1}"
                                subs.add(i to label)
                            }
                            C.TRACK_TYPE_VIDEO -> {
                                if (format.height > 0) {
                                    val label = "${format.height}p"
                                    quals.add(i to label)
                                }
                            }
                        }
                    }
                }
                subtitleTracks = subs
                qualityTracks = quals.distinctBy { it.second }
            }
        }
        exoPlayer.addListener(tracksListener)
    }

    // Auto-hide controls after 5 seconds
    val coroutineScope = rememberCoroutineScope()
    fun scheduleHideControls() {
        hideControlsJob?.cancel()
        hideControlsJob = coroutineScope.launch {
            delay(5000)
            controlsVisible = false
        }
    }

    // Request focus on mount
    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .focusRequester(focusRequester)
            .focusable()
            .onPreviewKeyEvent { event ->
                val currentPlayer = player.value ?: return@onPreviewKeyEvent false
                if (event.type == KeyEventType.KeyDown) {
                    when (event.key) {
                        Key.DirectionCenter, Key.Enter, Key.NumPadEnter -> {
                            if (!controlsVisible) {
                                controlsVisible = true
                                scheduleHideControls()
                            } else {
                                currentPlayer.playWhenReady = !currentPlayer.playWhenReady
                                showCenterPlayIcon = true
                            }
                            true
                        }
                        Key.DirectionLeft -> {
                            if (controlsVisible) {
                                // Skip back 10s for VOD only
                                if (!isLiveChannel) {
                                    currentPlayer.seekTo(maxOf(0L, currentPlayer.currentPosition - 10_000L))
                                }
                                scheduleHideControls()
                            } else {
                                controlsVisible = true
                                scheduleHideControls()
                            }
                            true
                        }
                        Key.DirectionRight -> {
                            if (controlsVisible) {
                                // Skip forward 10s for VOD only
                                if (!isLiveChannel) {
                                    currentPlayer.seekTo(
                                        minOf(
                                            currentPlayer.duration.coerceAtLeast(0L),
                                            currentPlayer.currentPosition + 10_000L
                                        )
                                    )
                                }
                                scheduleHideControls()
                            } else {
                                controlsVisible = true
                                scheduleHideControls()
                            }
                            true
                        }
                        Key.DirectionUp, Key.DirectionDown -> {
                            if (controlsVisible) {
                                scheduleHideControls()
                            } else {
                                controlsVisible = true
                                scheduleHideControls()
                            }
                            false
                        }
                        Key.Back, Key.Escape -> {
                            if (controlsVisible) {
                                controlsVisible = false
                                true
                            } else {
                                onBack()
                                true
                            }
                        }
                        Key.MediaPlayPause -> {
                            currentPlayer.playWhenReady = !currentPlayer.playWhenReady
                            showCenterPlayIcon = true
                            true
                        }
                        Key.MediaPlay -> {
                            currentPlayer.play()
                            showCenterPlayIcon = true
                            true
                        }
                        Key.MediaPause -> {
                            currentPlayer.pause()
                            showCenterPlayIcon = true
                            true
                        }
                        else -> {
                            if (!controlsVisible) {
                                controlsVisible = true
                                scheduleHideControls()
                            }
                            false
                        }
                    }
                } else false
            }
    ) {
        player.value?.let { exoPlayer ->
            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        this.player = exoPlayer
                        resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                        useController = false // We build our own controls
                        setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
                        layoutParams = FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        playerViewRef = this
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        // Netflix-style overlay with top and bottom bars
        NetflixPlayerOverlay(
            controlsVisible = controlsVisible,
            contentType = contentType,
            contentTitle = contentTitle,
            contentSubtitle = contentSubtitle,
            contentYear = contentYear,
            isLiveChannel = isLiveChannel,
            currentEpgTitle = currentEpgTitle,
            currentEpgProgress = currentEpgProgress,
            currentPositionMs = currentPositionMs,
            durationMs = durationMs,
            isPlaying = isPlaying,
            seriesId = seriesId,
            focusedButton = focusedButton,
            onFocusButtonChange = { focusedButton = it },
            onBack = onBack,
            onPlayPauseClick = {
                player.value?.playWhenReady = !(player.value?.isPlaying ?: false)
                showCenterPlayIcon = true
                scheduleHideControls()
            },
            onSkipBackClick = {
                player.value?.seekTo(maxOf(0L, player.value?.currentPosition?.minus(10_000L) ?: 0L))
                scheduleHideControls()
            },
            onSkipForwardClick = {
                val dur = player.value?.duration ?: 0L
                player.value?.seekTo(minOf(dur, player.value?.currentPosition?.plus(10_000L) ?: 0L))
                scheduleHideControls()
            },
            onSeek = { positionMs ->
                player.value?.seekTo(positionMs)
                scheduleHideControls()
            }
        )

        // Center play/pause indicator
        if (showCenterPlayIcon) {
            LaunchedEffect(Unit) {
                delay(800)
                showCenterPlayIcon = false
            }
            CenterPlayPauseIndicator(isPlaying = isPlaying)
        }

        // Top bar with gradient background
        AnimatedVisibility(
            visible = controlsVisible,
            enter = fadeIn() + slideInVertically(initialOffsetY = { -it }),
            exit = fadeOut() + slideOutVertically(targetOffsetY = { -it }),
            modifier = Modifier.align(Alignment.TopStart)
        ) {
            PlayerTopBar(
                contentTitle = contentTitle,
                contentSubtitle = contentSubtitle,
                isLiveChannel = isLiveChannel,
                onBack = onBack
            )
        }

        // Bottom controls bar with gradient background
        AnimatedVisibility(
            visible = controlsVisible,
            enter = fadeIn() + slideInVertically(initialOffsetY = { it }),
            exit = fadeOut() + slideOutVertically(targetOffsetY = { it }),
            modifier = Modifier.align(Alignment.BottomStart)
        ) {
            PlayerBottomBar(
                currentPositionMs = currentPositionMs,
                durationMs = durationMs,
                isPlaying = isPlaying,
                isLiveChannel = isLiveChannel,
                seriesId = seriesId,
                focusedButton = focusedButton,
                onFocusButtonChange = { focusedButton = it },
                onPlayPauseClick = {
                    player.value?.playWhenReady = !(player.value?.isPlaying ?: false)
                    showCenterPlayIcon = true
                    scheduleHideControls()
                },
                onSkipBackClick = {
                    player.value?.seekTo(maxOf(0L, player.value?.currentPosition?.minus(10_000L) ?: 0L))
                    scheduleHideControls()
                },
                onSkipForwardClick = {
                    val dur = player.value?.duration ?: 0L
                    player.value?.seekTo(minOf(dur, player.value?.currentPosition?.plus(10_000L) ?: 0L))
                    scheduleHideControls()
                },
                onSeek = { positionMs ->
                    player.value?.seekTo(positionMs)
                    scheduleHideControls()
                },
                onSubtitleClick = { showSubtitleMenu = !showSubtitleMenu; showSpeedMenu = false; showQualityMenu = false },
                onSpeedClick = { showSpeedMenu = !showSpeedMenu; showSubtitleMenu = false; showQualityMenu = false },
                hasSubtitles = subtitleTracks.isNotEmpty(),
                hasQualities = qualityTracks.size > 1,
                onQualityClick = { showQualityMenu = !showQualityMenu; showSubtitleMenu = false; showSpeedMenu = false },
                currentSpeed = currentSpeed
            )
        }

        // Speed selection menu
        if (showSpeedMenu) {
            SpeedSelectionMenu(
                speeds = speedOptions,
                currentSpeed = currentSpeed,
                onSelect = { speed ->
                    currentSpeed = speed
                    player.value?.playbackParameters = PlaybackParameters(speed)
                    showSpeedMenu = false
                    scheduleHideControls()
                },
                onDismiss = { showSpeedMenu = false }
            )
        }

        // Subtitle selection menu
        if (showSubtitleMenu) {
            TrackSelectionMenu(
                title = "Subtitulos",
                tracks = subtitleTracks,
                selectedIndex = selectedSubtitleIndex,
                onSelect = { index ->
                    selectedSubtitleIndex = index
                    val exoPlayer = player.value ?: return@TrackSelectionMenu
                    if (index == -1) {
                        // Disable subtitles
                        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                            .buildUpon()
                            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                            .build()
                    } else {
                        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                            .buildUpon()
                            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                            .build()
                    }
                    showSubtitleMenu = false
                    scheduleHideControls()
                },
                onDismiss = { showSubtitleMenu = false }
            )
        }

        // Quality selection menu
        if (showQualityMenu) {
            TrackSelectionMenu(
                title = "Calidad",
                tracks = qualityTracks,
                selectedIndex = selectedQualityIndex,
                showAuto = true,
                onSelect = { index ->
                    selectedQualityIndex = index
                    val exoPlayer = player.value ?: return@TrackSelectionMenu
                    if (index == -1) {
                        // Auto quality
                        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                            .buildUpon()
                            .clearOverridesOfType(C.TRACK_TYPE_VIDEO)
                            .build()
                    } else {
                        // Find the matching video track group
                        for (group in exoPlayer.currentTracks.groups) {
                            if (group.mediaTrackGroup.type == C.TRACK_TYPE_VIDEO) {
                                for (i in 0 until group.mediaTrackGroup.length) {
                                    val fmt = group.mediaTrackGroup.getFormat(i)
                                    val label = "${fmt.height}p"
                                    if (qualityTracks.getOrNull(index)?.second == label) {
                                        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                                            .buildUpon()
                                            .addOverride(TrackSelectionOverride(group.mediaTrackGroup, listOf(i)))
                                            .build()
                                        break
                                    }
                                }
                            }
                        }
                    }
                    showQualityMenu = false
                    scheduleHideControls()
                },
                onDismiss = { showQualityMenu = false }
            )
        }

        // Debug overlay (only in debug builds)
        if (BuildConfig.DEBUG && showDebug) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.9f))
                    .padding(8.dp)
            ) {
                Text(
                    text = "URL: $url\n$debugInfo",
                    color = TextSecondary,
                    fontSize = 10.sp,
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                )
            }
        }

        // Debug button
        if (BuildConfig.DEBUG) {
            TextButton(
                onClick = { showDebug = !showDebug },
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(16.dp)
            ) {
                Text("DEBUG", color = Primary400, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun NetflixPlayerOverlay(
    controlsVisible: Boolean,
    contentType: String?,
    contentTitle: String,
    contentSubtitle: String,
    contentYear: String,
    isLiveChannel: Boolean,
    currentEpgTitle: String,
    currentEpgProgress: Float,
    currentPositionMs: Long,
    durationMs: Long,
    isPlaying: Boolean,
    seriesId: Int?,
    focusedButton: Int,
    onFocusButtonChange: (Int) -> Unit,
    onBack: () -> Unit,
    onPlayPauseClick: () -> Unit,
    onSkipBackClick: () -> Unit,
    onSkipForwardClick: () -> Unit,
    onSeek: (Long) -> Unit
) {
    // This composable is now replaced by individual top and bottom bars
    // Kept for potential future use or gradual refactoring
}

@Composable
private fun PlayerTopBar(
    contentTitle: String,
    contentSubtitle: String,
    isLiveChannel: Boolean,
    onBack: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp)
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        Color.Black.copy(alpha = 0.9f),
                        Color.Black.copy(alpha = 0.3f)
                    )
                )
            )
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Back button
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .tvFocusable(shape = RoundedCornerShape(24.dp))
                    .size(48.dp)
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.player_back), tint = Color.White, modifier = Modifier.size(28.dp))
            }

            // Title and subtitle
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 16.dp)
            ) {
                Text(
                    text = contentTitle,
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1
                )
                if (contentSubtitle.isNotEmpty()) {
                    Text(
                        text = contentSubtitle,
                        color = TextSecondary,
                        fontSize = 14.sp,
                        maxLines = 1
                    )
                }
            }

            // Live badge
            if (isLiveChannel) {
                Row(
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .border(1.dp, LiveRed, RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(LiveRed)
                    )
                    Text("EN DIRECTO", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun PlayerBottomBar(
    currentPositionMs: Long,
    durationMs: Long,
    isPlaying: Boolean,
    isLiveChannel: Boolean,
    seriesId: Int?,
    focusedButton: Int,
    onFocusButtonChange: (Int) -> Unit,
    onPlayPauseClick: () -> Unit,
    onSkipBackClick: () -> Unit,
    onSkipForwardClick: () -> Unit,
    onSeek: (Long) -> Unit,
    onSubtitleClick: () -> Unit = {},
    onSpeedClick: () -> Unit = {},
    onQualityClick: () -> Unit = {},
    hasSubtitles: Boolean = false,
    hasQualities: Boolean = false,
    currentSpeed: Float = 1f
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        Color.Black.copy(alpha = 0.3f),
                        Color.Black.copy(alpha = 0.9f)
                    )
                )
            )
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Progress bar
        PlayerProgressBar(
            currentPositionMs = currentPositionMs,
            durationMs = durationMs,
            isFocused = focusedButton == 0,
            isLiveChannel = isLiveChannel,
            onFocus = { onFocusButtonChange(0) },
            onSeek = onSeek
        )

        // Action buttons
        Row(
            modifier = Modifier
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Play/Pause
            PlayerActionButton(
                icon = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                contentDescription = if (isPlaying) stringResource(R.string.player_pause) else stringResource(R.string.player_play),
                isFocused = focusedButton == 1,
                onFocus = { onFocusButtonChange(1) },
                onClick = onPlayPauseClick,
                modifier = Modifier.weight(1f)
            )

            // Skip back (only for VOD)
            if (!isLiveChannel) {
                PlayerActionButton(
                    icon = Icons.Filled.SkipPrevious,
                    contentDescription = stringResource(R.string.player_seek_back),
                    isFocused = focusedButton == 2,
                    onFocus = { onFocusButtonChange(2) },
                    onClick = onSkipBackClick,
                    modifier = Modifier.weight(1f)
                )
            }

            // Skip forward (only for VOD)
            if (!isLiveChannel) {
                PlayerActionButton(
                    icon = Icons.Filled.SkipNext,
                    contentDescription = stringResource(R.string.player_seek_forward),
                    isFocused = focusedButton == 3,
                    onFocus = { onFocusButtonChange(3) },
                    onClick = onSkipForwardClick,
                    modifier = Modifier.weight(1f)
                )
            }

            // Subtitles (only if tracks available)
            if (hasSubtitles) {
                PlayerActionButton(
                    icon = Icons.Filled.VolumeUp,
                    contentDescription = stringResource(R.string.player_subtitles),
                    isFocused = focusedButton == 4,
                    onFocus = { onFocusButtonChange(4) },
                    onClick = onSubtitleClick,
                    modifier = Modifier.weight(1f)
                )
            }

            // Quality (only if multiple tracks)
            if (hasQualities) {
                PlayerActionButton(
                    icon = Icons.Filled.Settings,
                    contentDescription = stringResource(R.string.player_quality),
                    isFocused = focusedButton == 5,
                    onFocus = { onFocusButtonChange(5) },
                    onClick = onQualityClick,
                    modifier = Modifier.weight(1f)
                )
            }

            // Speed
            PlayerActionButton(
                icon = Icons.Filled.Settings,
                contentDescription = stringResource(R.string.player_speed, currentSpeed),
                isFocused = focusedButton == 6,
                onFocus = { onFocusButtonChange(6) },
                onClick = onSpeedClick,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun PlayerProgressBar(
    currentPositionMs: Long,
    durationMs: Long,
    isFocused: Boolean,
    isLiveChannel: Boolean,
    onFocus: () -> Unit,
    onSeek: (Long) -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val focusState by interactionSource.collectIsFocusedAsState()
    val isFocusedNow = focusState || isFocused

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .focusable(interactionSource = interactionSource)
            .tvFocusable(shape = RoundedCornerShape(3.dp)),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Progress bar with scrubber
        val progress = if (durationMs > 0) (currentPositionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
        val barHeight = if (isFocusedNow) 6.dp else 3.dp

        androidx.compose.foundation.layout.BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .height(16.dp),
            contentAlignment = Alignment.Center
        ) {
            val barWidthPx = constraints.maxWidth

            // Track background
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(barHeight)
                    .clip(RoundedCornerShape(2.dp))
                    .background(Color.White.copy(alpha = 0.3f))
            ) {
                // Played portion
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(progress.coerceAtLeast(0.001f))
                        .background(LiveRed)
                )
            }

            // Scrubber dot positioned by fraction
            val scrubberSize = if (isFocusedNow) 14.dp else 10.dp
            val offsetPx = (progress * barWidthPx).toInt()
            Box(
                modifier = Modifier
                    .offset { IntOffset(offsetPx - (scrubberSize.roundToPx() / 2), 0) }
                    .size(scrubberSize)
                    .clip(CircleShape)
                    .background(Color.White)
                    .align(Alignment.CenterStart)
            )
        }

        // Time display
        Row(
            modifier = Modifier
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (!isLiveChannel) {
                Text(
                    text = TimeUtil.formatDuration(currentPositionMs / 1000L),
                    color = Color.White,
                    fontSize = 12.sp
                )
                Text(
                    text = TimeUtil.formatDuration(durationMs / 1000L),
                    color = TextSecondary,
                    fontSize = 12.sp
                )
            } else {
                Text(
                    text = "EN DIRECTO",
                    color = LiveRed,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun PlayerActionButton(
    icon: ImageVector,
    contentDescription: String,
    isFocused: Boolean,
    onFocus: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.1f else 1f,
        animationSpec = tween(durationMillis = 200),
        label = "buttonScale"
    )

    IconButton(
        onClick = onClick,
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .border(
                width = if (isFocused) 2.dp else 1.dp,
                color = if (isFocused) Color.White else Color.White.copy(alpha = 0.5f),
                shape = RoundedCornerShape(8.dp)
            )
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .focusable(interactionSource = interactionSource)
            .tvFocusable(shape = RoundedCornerShape(8.dp)),
        interactionSource = interactionSource
    ) {
        Icon(
            icon,
            contentDescription,
            tint = Color.White,
            modifier = Modifier.size(24.dp)
        )
    }

    LaunchedEffect(interactionSource) {
        interactionSource.interactions.collect { interaction ->
            if (interaction is androidx.compose.foundation.interaction.FocusInteraction.Focus) {
                onFocus()
            }
        }
    }
}

@Composable
private fun CenterPlayPauseIndicator(isPlaying: Boolean) {
    val scale by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(durationMillis = 300),
        label = "centerIconScale"
    )

    Box(
        modifier = Modifier
            .fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(140.dp)
                .clip(CircleShape)
                .background(Color.Black.copy(alpha = 0.6f))
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (isPlaying) Icons.Filled.PlayArrow else Icons.Filled.Pause,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(72.dp)
            )
        }
    }
}

@Composable
private fun SpeedSelectionMenu(
    speeds: List<Float>,
    currentSpeed: Float,
    onSelect: (Float) -> Unit,
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.5f))
            .focusable(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .width(200.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF1A1A2E))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                "Velocidad",
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            speeds.forEach { speed ->
                val isSelected = speed == currentSpeed
                TextButton(
                    onClick = { onSelect(speed) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .tvFocusable(shape = RoundedCornerShape(8.dp))
                ) {
                    Text(
                        "${speed}x",
                        color = if (isSelected) Primary400 else Color.White,
                        fontSize = 14.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
            TextButton(
                onClick = onDismiss,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .tvFocusable(shape = RoundedCornerShape(8.dp))
            ) {
                Text("Cerrar", color = TextMuted, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun TrackSelectionMenu(
    title: String,
    tracks: List<Pair<Int, String>>,
    selectedIndex: Int,
    showAuto: Boolean = false,
    onSelect: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.5f))
            .focusable(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .width(220.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF1A1A2E))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                title,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            if (showAuto) {
                val isSelected = selectedIndex == -1
                TextButton(
                    onClick = { onSelect(-1) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .tvFocusable(shape = RoundedCornerShape(8.dp))
                ) {
                    Text(
                        "Auto",
                        color = if (isSelected) Primary400 else Color.White,
                        fontSize = 14.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
            // Off option for subtitles
            if (!showAuto) {
                val isOff = selectedIndex == -1
                TextButton(
                    onClick = { onSelect(-1) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .tvFocusable(shape = RoundedCornerShape(8.dp))
                ) {
                    Text(
                        "Desactivado",
                        color = if (isOff) Primary400 else Color.White,
                        fontSize = 14.sp,
                        fontWeight = if (isOff) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
            tracks.forEachIndexed { index, (_, label) ->
                val isSelected = index == selectedIndex
                TextButton(
                    onClick = { onSelect(index) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .tvFocusable(shape = RoundedCornerShape(8.dp))
                ) {
                    Text(
                        label,
                        color = if (isSelected) Primary400 else Color.White,
                        fontSize = 14.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
            TextButton(
                onClick = onDismiss,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .tvFocusable(shape = RoundedCornerShape(8.dp))
            ) {
                Text("Cerrar", color = TextMuted, fontSize = 13.sp)
            }
        }
    }
}
