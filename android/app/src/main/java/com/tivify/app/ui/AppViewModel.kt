package com.tivify.app.ui

import androidx.lifecycle.ViewModel
import com.tivify.app.data.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharedFlow
import javax.inject.Inject

/**
 * Activity-scoped ViewModel that exposes app-wide events from TokenManager.
 * Consumed by AppNavigation to react to session expiry (401 Unauthorized).
 */
@HiltViewModel
class AppViewModel @Inject constructor(
    tokenManager: TokenManager
) : ViewModel() {
    val unauthorizedEvent: SharedFlow<Unit> = tokenManager.unauthorizedEvent
}
