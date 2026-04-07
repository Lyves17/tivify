package com.tivify.app.ui.login

import android.content.Context
import android.util.Log
import android.util.Patterns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tivify.app.R
import com.tivify.app.data.SavedAccount
import com.tivify.app.data.TokenManager
import com.tivify.app.data.api.AuthInterceptor
import com.tivify.app.data.api.BaseUrlInterceptor
import com.tivify.app.data.api.LoginRequest
import com.tivify.app.data.api.TivifyApi
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class LoginState(
    val serverUrl: String = "",
    val username: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isLoggedIn: Boolean = false,
    val rememberMe: Boolean = true,
    val savedAccounts: List<SavedAccount> = emptyList(),
    val savedServers: List<String> = emptyList()
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: TivifyApi,
    private val tokenManager: TokenManager,
    private val authInterceptor: AuthInterceptor,
    private val baseUrlInterceptor: BaseUrlInterceptor
) : ViewModel() {
    companion object {
        private const val TAG = "LoginViewModel"
    }

    private val _state = MutableStateFlow(LoginState())
    val state: StateFlow<LoginState> = _state

    init {
        viewModelScope.launch {
            val savedUrl = tokenManager.getServerUrl().firstOrNull()
            val savedToken = tokenManager.getToken().firstOrNull()
            val accounts = tokenManager.getSavedAccounts().firstOrNull() ?: emptyList()
            val servers = tokenManager.getSavedServers().firstOrNull() ?: emptyList()

            _state.value = _state.value.copy(
                serverUrl = savedUrl ?: "",
                savedAccounts = accounts,
                savedServers = servers
            )

            // Validate saved token against the server – if expired/invalid stay on login
            if (!savedToken.isNullOrEmpty() && !savedUrl.isNullOrEmpty()) {
                _state.value = _state.value.copy(isLoading = true)
                try {
                    api.me()
                    _state.value = _state.value.copy(isLoading = false, isLoggedIn = true)
                } catch (e: Exception) {
                    // Token invalid or server unreachable – clear credentials and show login
                    Timber.w(e, "Saved token validation failed, clearing credentials")
                    tokenManager.clear()
                    _state.value = _state.value.copy(isLoading = false)
                }
            }
        }
    }

    fun updateServerUrl(url: String) {
        _state.value = _state.value.copy(serverUrl = url, error = null)
    }

    fun updateUsername(username: String) {
        _state.value = _state.value.copy(username = username, error = null)
    }

    fun updatePassword(password: String) {
        _state.value = _state.value.copy(password = password, error = null)
    }

    fun updateRememberMe(value: Boolean) {
        _state.value = _state.value.copy(rememberMe = value)
    }

    /** Pre-fill server URL and username from a saved account entry. */
    fun selectSavedAccount(account: SavedAccount) {
        _state.value = _state.value.copy(
            serverUrl = account.serverUrl,
            username = account.username,
            error = null
        )
    }

    /** Pre-fill server URL from a saved server. */
    fun selectServer(url: String) {
        _state.value = _state.value.copy(
            serverUrl = url,
            error = null
        )
    }

    /** Remove a server from the saved list. */
    fun removeServer(url: String) {
        viewModelScope.launch {
            tokenManager.removeServer(url)
            val updated = tokenManager.getSavedServers().firstOrNull() ?: emptyList()
            _state.value = _state.value.copy(savedServers = updated)
        }
    }

    fun login() {
        val s = _state.value
        if (s.serverUrl.isBlank() || s.username.isBlank() || s.password.isBlank()) {
            _state.value = s.copy(error = context.getString(R.string.error_fields_required))
            return
        }

        // Validate URL format
        val cleanUrl = s.serverUrl.trimEnd('/')
        if (!isValidUrl(cleanUrl)) {
            _state.value = s.copy(error = context.getString(R.string.error_invalid_url))
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                tokenManager.saveServerUrl(cleanUrl)
                val response = api.login(LoginRequest(s.username, s.password))
                if (response.success && response.data != null) {
                    tokenManager.saveToken(response.data.accessToken)
                    tokenManager.saveUser(response.data.user)
                    tokenManager.saveServer(cleanUrl)
                    if (s.rememberMe) {
                        tokenManager.saveAccount(cleanUrl, s.username)
                    }
                    // Update interceptors with new credentials synchronously
                    // This prevents them from reading stale values from DataStore
                    authInterceptor.updateCachedCredentials()
                    baseUrlInterceptor.updateCachedServerUrl()
                    Log.i(TAG, "Login successful, credentials cached in interceptors")
                    _state.value = _state.value.copy(isLoading = false, isLoggedIn = true)
                } else {
                    _state.value = _state.value.copy(
                        isLoading = false,
                        error = response.message ?: context.getString(R.string.error_invalid_credentials)
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Login failed", e)
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "${context.getString(R.string.error_network)}: ${e.localizedMessage}"
                )
            }
        }
    }

    private fun isValidUrl(url: String): Boolean {
        return try {
            val urlObj = java.net.URL(url)
            // Must have http or https scheme
            val scheme = urlObj.protocol
            (scheme == "http" || scheme == "https") &&
            // Must have a host
            !urlObj.host.isNullOrEmpty()
        } catch (e: Exception) {
            Log.w(TAG, "Invalid URL format: $url", e)
            false
        }
    }
}
