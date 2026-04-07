package com.tivify.app.ui.about

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tivify.app.BuildConfig
import com.tivify.app.data.api.TivifyApi
import com.tivify.app.ui.components.tvFocusable
import com.tivify.app.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ServerVersionInfo(
    val version: String = "",
    val buildDate: String = ""
)

data class AboutState(
    val serverVersion: ServerVersionInfo? = null,
    val isLoading: Boolean = true
)

@HiltViewModel
class AboutViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {

    private val _state = MutableStateFlow(AboutState())
    val state: StateFlow<AboutState> = _state

    init {
        loadServerVersion()
    }

    private fun loadServerVersion() {
        viewModelScope.launch {
            try {
                val response = api.getVersion()
                if (response.success) {
                    _state.value = AboutState(
                        serverVersion = ServerVersionInfo(
                            version = response.data?.get("version")?.toString() ?: "",
                            buildDate = response.data?.get("build_date")?.toString() ?: ""
                        ),
                        isLoading = false
                    )
                } else {
                    _state.value = AboutState(isLoading = false)
                }
            } catch (_: Exception) {
                _state.value = AboutState(isLoading = false)
            }
        }
    }
}

@Composable
fun AboutScreen(
    onBack: () -> Unit,
    viewModel: AboutViewModel = androidx.hilt.navigation.compose.hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.tvFocusable(shape = RoundedCornerShape(24.dp))
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver", tint = TextPrimary)
            }
            Text(
                text = "Acerca de",
                color = TextPrimary,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // App icon
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Primary600),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                Icons.Default.PlayArrow,
                contentDescription = null,
                tint = TextPrimary,
                modifier = Modifier.size(48.dp)
            )
        }

        Text(
            text = "TIVIFY",
            color = TextPrimary,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold
        )

        Text(
            text = "v${BuildConfig.APP_VERSION}",
            color = Primary400,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Version info card
        Card(
            colors = CardDefaults.cardColors(containerColor = DarkCard),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Informacion de version",
                    color = TextPrimary,
                    fontWeight = FontWeight.SemiBold
                )

                HorizontalDivider(color = DarkBorder)

                InfoRow("Version de la app", "v${BuildConfig.APP_VERSION}")
                InfoRow("Build", BuildConfig.BUILD_TIMESTAMP)

                if (state.isLoading) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Version del servidor", color = TextMuted, fontSize = 14.sp)
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = Primary500,
                            strokeWidth = 2.dp
                        )
                    }
                } else if (state.serverVersion != null) {
                    InfoRow("Version del servidor", "v${state.serverVersion!!.version}")
                    if (state.serverVersion!!.buildDate.isNotEmpty()) {
                        InfoRow("Build del servidor", state.serverVersion!!.buildDate)
                    }
                } else {
                    InfoRow("Version del servidor", "No disponible")
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Plataforma de streaming personal",
            color = TextMuted,
            fontSize = 13.sp
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = TextMuted, fontSize = 14.sp)
        Text(value, color = TextSecondary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}
