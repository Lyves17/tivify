package com.tivify.app.ui.profile

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tivify.app.R
import com.tivify.app.data.TokenManager
import com.tivify.app.data.api.ChangePasswordRequest
import com.tivify.app.data.api.TivifyApi
import com.tivify.app.data.api.UpdateProfileRequest
import com.tivify.app.data.api.UserData
import com.tivify.app.BuildConfig
import com.tivify.app.ui.components.TvOutlinedTextField
import com.tivify.app.ui.components.tvFocusable
import com.tivify.app.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileState(
    val user: UserData? = null,
    val email: String = "",
    val currentPassword: String = "",
    val newPassword: String = "",
    val confirmPassword: String = "",
    val message: String? = null,
    val isError: Boolean = false
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: TivifyApi,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileState())
    val state: StateFlow<ProfileState> = _state

    init {
        viewModelScope.launch {
            val user = tokenManager.getUser().firstOrNull()
            _state.value = _state.value.copy(user = user, email = user?.email ?: "")
        }
    }

    fun updateEmail(email: String) {
        _state.value = _state.value.copy(email = email, message = null)
    }

    fun updateCurrentPassword(p: String) {
        _state.value = _state.value.copy(currentPassword = p, message = null)
    }

    fun updateNewPassword(p: String) {
        _state.value = _state.value.copy(newPassword = p, message = null)
    }

    fun updateConfirmPassword(p: String) {
        _state.value = _state.value.copy(confirmPassword = p, message = null)
    }

    fun saveEmail() {
        viewModelScope.launch {
            try {
                api.updateProfile(UpdateProfileRequest(_state.value.email))
                _state.value = _state.value.copy(message = context.getString(R.string.success_email_updated), isError = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(message = "Error: ${e.localizedMessage}", isError = true)
            }
        }
    }

    fun changePassword() {
        val s = _state.value
        if (s.newPassword != s.confirmPassword) {
            _state.value = s.copy(message = context.getString(R.string.error_password_mismatch), isError = true)
            return
        }

        // Validate password strength: 8+ chars, at least one uppercase, one lowercase, one digit
        val passwordError = validatePasswordStrength(s.newPassword)
        if (passwordError != null) {
            _state.value = s.copy(message = passwordError, isError = true)
            return
        }

        viewModelScope.launch {
            try {
                api.changePassword(ChangePasswordRequest(s.currentPassword, s.newPassword))
                _state.value = _state.value.copy(
                    currentPassword = "",
                    newPassword = "",
                    confirmPassword = "",
                    message = context.getString(R.string.success_password_changed),
                    isError = false
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(message = "Error: ${e.localizedMessage}", isError = true)
            }
        }
    }

    private fun validatePasswordStrength(password: String): String? {
        return when {
            password.length < 8 -> context.getString(R.string.error_password_min_length)
            !password.any { it.isUpperCase() } -> context.getString(R.string.error_password_no_uppercase)
            !password.any { it.isLowerCase() } -> context.getString(R.string.error_password_no_lowercase)
            !password.any { it.isDigit() } -> context.getString(R.string.error_password_no_digit)
            else -> null
        }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            try { api.logout() } catch (_: Exception) {}
            tokenManager.clear()
            onDone()
        }
    }
}

@Composable
fun ProfileScreen(
    onLogout: () -> Unit,
    onFavoritesClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onEpgClick: () -> Unit,
    onHelpClick: () -> Unit,
    onAboutClick: () -> Unit,
    viewModel: ProfileViewModel = androidx.hilt.navigation.compose.hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Perfil",
            color = TextPrimary,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        // User info card
        Card(
            colors = CardDefaults.cardColors(containerColor = DarkCard),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(Primary600),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = (state.user?.username?.firstOrNull() ?: 'U').uppercase(),
                            color = TextPrimary,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Column {
                        Text(
                            text = state.user?.username ?: "",
                            color = TextPrimary,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = state.user?.role ?: "",
                            color = TextMuted,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }

        // Quick links
        ProfileMenuItem(icon = Icons.Default.Favorite, label = "Favoritos", onClick = onFavoritesClick)
        ProfileMenuItem(icon = Icons.Default.History, label = "Historial", onClick = onHistoryClick)
        ProfileMenuItem(icon = Icons.AutoMirrored.Filled.List, label = "Guia EPG", onClick = onEpgClick)
        ProfileMenuItem(icon = Icons.Default.HelpOutline, label = "Ayuda", onClick = onHelpClick)
        ProfileMenuItem(icon = Icons.Default.Info, label = "Acerca de", onClick = onAboutClick)

        // Email section
        Card(
            colors = CardDefaults.cardColors(containerColor = DarkCard),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Email", color = TextPrimary, fontWeight = FontWeight.SemiBold)
                TvOutlinedTextField(
                    value = state.email,
                    onValueChange = viewModel::updateEmail,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors()
                )
                Button(
                    onClick = viewModel::saveEmail,
                    colors = ButtonDefaults.buttonColors(containerColor = Primary600),
                    modifier = Modifier
                        .align(Alignment.End)
                        .tvFocusable(shape = RoundedCornerShape(8.dp))
                ) {
                    Text("Guardar", fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // Password section
        Card(
            colors = CardDefaults.cardColors(containerColor = DarkCard),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Cambiar contrasena", color = TextPrimary, fontWeight = FontWeight.SemiBold)
                TvOutlinedTextField(
                    value = state.currentPassword,
                    onValueChange = viewModel::updateCurrentPassword,
                    label = { Text("Contrasena actual") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors()
                )
                TvOutlinedTextField(
                    value = state.newPassword,
                    onValueChange = viewModel::updateNewPassword,
                    label = { Text("Nueva contrasena") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors()
                )
                TvOutlinedTextField(
                    value = state.confirmPassword,
                    onValueChange = viewModel::updateConfirmPassword,
                    label = { Text("Confirmar contrasena") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors()
                )
                Button(
                    onClick = viewModel::changePassword,
                    colors = ButtonDefaults.buttonColors(containerColor = Primary600),
                    modifier = Modifier
                        .align(Alignment.End)
                        .tvFocusable(shape = RoundedCornerShape(8.dp))
                ) {
                    Text("Cambiar", fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // Message
        state.message?.let {
            Text(
                text = it,
                color = if (state.isError) LiveRed else SuccessGreen,
                fontSize = 14.sp
            )
        }

        // Logout
        Button(
            onClick = { viewModel.logout(onLogout) },
            colors = ButtonDefaults.buttonColors(containerColor = LiveRed),
            modifier = Modifier
                .fillMaxWidth()
                .tvFocusable(shape = RoundedCornerShape(8.dp))
        ) {
            Icon(Icons.Default.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Cerrar sesion", fontWeight = FontWeight.SemiBold)
        }

        // App version
        Text(
            text = "Tivify v${BuildConfig.APP_VERSION}",
            color = TextMuted,
            fontSize = 12.sp,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )
    }
}

@Composable
private fun ProfileMenuItem(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .tvFocusable(shape = RoundedCornerShape(12.dp))
            .clip(RoundedCornerShape(12.dp))
            .background(DarkCard)
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(icon, contentDescription = null, tint = Primary400, modifier = Modifier.size(28.dp))
        Text(label, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(24.dp))
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = TextPrimary,
    unfocusedTextColor = TextPrimary,
    focusedBorderColor = Primary500,
    unfocusedBorderColor = DarkBorder,
    focusedLabelColor = Primary400,
    unfocusedLabelColor = TextMuted,
    cursorColor = Primary500
)
