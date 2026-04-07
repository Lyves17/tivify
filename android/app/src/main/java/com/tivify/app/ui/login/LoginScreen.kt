package com.tivify.app.ui.login

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import com.tivify.app.ui.components.TvOutlinedTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.tivify.app.ui.components.tvFocusable
import com.tivify.app.ui.theme.*

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val focusManager = LocalFocusManager.current
    val usernameFocusRequester = remember { FocusRequester() }
    var passwordVisible by remember { mutableStateOf(false) }
    val screenWidthDp = LocalConfiguration.current.screenWidthDp
    val loginMaxWidth = when {
        screenWidthDp > 1200 -> 560.dp  // TV
        screenWidthDp > 800 -> 480.dp   // Tablet
        else -> 400.dp                  // Phone
    }

    LaunchedEffect(state.isLoggedIn) {
        if (state.isLoggedIn) onLoginSuccess()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .navigationBarsPadding()
            .imePadding(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = loginMaxWidth)
                .verticalScroll(rememberScrollState())
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = "TIVIFY",
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                color = Primary500
            )

            Text(
                text = "Inicia sesion en tu servidor",
                style = MaterialTheme.typography.bodyLarge,
                color = TextSecondary
            )

            Spacer(modifier = Modifier.height(4.dp))

            // ---- Saved servers (quick select) ----
            if (state.savedServers.isNotEmpty()) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "Servidores recientes",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted,
                        modifier = Modifier.padding(horizontal = 4.dp)
                    )
                    state.savedServers.forEach { serverUrl ->
                        val isSelected = state.serverUrl == serverUrl
                        Surface(
                            onClick = {
                                viewModel.selectServer(serverUrl)
                                focusManager.clearFocus()
                                // Request focus on username field after selecting server
                                try { usernameFocusRequester.requestFocus() } catch (_: Exception) {}
                            },
                            color = if (isSelected) Primary600.copy(alpha = 0.15f) else DarkCard,
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .tvFocusable(shape = RoundedCornerShape(10.dp)),
                            border = BorderStroke(
                                1.dp,
                                if (isSelected) Primary500 else DarkBorder
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(start = 4.dp, end = 4.dp, top = 2.dp, bottom = 2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = isSelected,
                                    onClick = {
                                        viewModel.selectServer(serverUrl)
                                        focusManager.clearFocus()
                                        try { usernameFocusRequester.requestFocus() } catch (_: Exception) {}
                                    },
                                    colors = RadioButtonDefaults.colors(
                                        selectedColor = Primary500,
                                        unselectedColor = TextMuted
                                    ),
                                    modifier = Modifier.size(36.dp)
                                )
                                Icon(
                                    Icons.Default.Dns,
                                    contentDescription = null,
                                    tint = if (isSelected) Primary400 else TextMuted,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = serverUrl,
                                    color = if (isSelected) TextPrimary else TextSecondary,
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.weight(1f)
                                )
                                IconButton(
                                    onClick = { viewModel.removeServer(serverUrl) },
                                    modifier = Modifier
                                        .size(32.dp)
                                        .tvFocusable(shape = RoundedCornerShape(16.dp))
                                ) {
                                    Icon(
                                        Icons.Default.Close,
                                        contentDescription = "Eliminar servidor",
                                        tint = TextMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))
            }

            // ---- Server URL ----
            TvOutlinedTextField(
                value = state.serverUrl,
                onValueChange = viewModel::updateServerUrl,
                label = { Text("Servidor") },
                placeholder = { Text("http://192.168.1.100") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Uri,
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                colors = loginFieldColors()
            )

            // ---- Username ----
            TvOutlinedTextField(
                value = state.username,
                onValueChange = viewModel::updateUsername,
                label = { Text("Usuario") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(usernameFocusRequester),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                colors = loginFieldColors()
            )

            // ---- Password ----
            TvOutlinedTextField(
                value = state.password,
                onValueChange = viewModel::updatePassword,
                label = { Text("Contrasena") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (passwordVisible) "Ocultar" else "Mostrar",
                            tint = TextMuted
                        )
                    }
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        focusManager.clearFocus()
                        viewModel.login()
                    }
                ),
                colors = loginFieldColors()
            )

            // ---- Remember me ----
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = state.rememberMe,
                    onCheckedChange = viewModel::updateRememberMe,
                    colors = CheckboxDefaults.colors(
                        checkedColor = Primary500,
                        uncheckedColor = TextMuted,
                        checkmarkColor = TextPrimary
                    )
                )
                Text(
                    text = "Recordar cuenta",
                    color = TextSecondary,
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            // ---- Error message ----
            state.error?.let {
                Text(
                    text = it,
                    color = LiveRed,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // ---- Login button ----
            Button(
                onClick = viewModel::login,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .tvFocusable(shape = RoundedCornerShape(8.dp)),
                enabled = !state.isLoading,
                colors = ButtonDefaults.buttonColors(containerColor = Primary600)
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = TextPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Entrar", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
            }

            // ---- Saved accounts (quick full login) ----
            if (state.savedAccounts.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "Cuentas guardadas",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted,
                        modifier = Modifier.padding(horizontal = 4.dp)
                    )
                    state.savedAccounts.forEach { account ->
                        Surface(
                            onClick = {
                                viewModel.selectSavedAccount(account)
                                focusManager.clearFocus()
                            },
                            color = DarkCard,
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .tvFocusable(shape = RoundedCornerShape(10.dp)),
                            border = BorderStroke(1.dp, DarkBorder)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(
                                    Icons.Default.AccountCircle,
                                    contentDescription = null,
                                    tint = Primary400,
                                    modifier = Modifier.size(22.dp)
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = account.username,
                                        color = TextPrimary,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = account.serverUrl,
                                        color = TextMuted,
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                                Icon(
                                    Icons.Default.ChevronRight,
                                    contentDescription = null,
                                    tint = TextMuted,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun loginFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = TextPrimary,
    unfocusedTextColor = TextPrimary,
    focusedBorderColor = Primary500,
    unfocusedBorderColor = DarkBorder,
    focusedLabelColor = Primary400,
    unfocusedLabelColor = TextMuted,
    cursorColor = Primary500,
    focusedPlaceholderColor = TextMuted,
    unfocusedPlaceholderColor = TextMuted
)
