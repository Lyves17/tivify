package com.tivify.app.data.api

import android.util.Log
import com.tivify.app.data.TokenManager
import kotlinx.coroutines.flow.firstOrNull
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Intercepts 401 Unauthorized responses, clears the stored token and emits an
 * unauthorized event so the UI can navigate back to the login screen.
 * Only triggers when a valid token was present (i.e. mid-session expiry).
 *
 * Auth endpoints (paths containing "/auth/") are excluded because their callers already handle
 * 401 responses (e.g. LoginViewModel clears the token and shows the login form).
 * Firing notifyUnauthorized() for these would create stale events that could
 * redirect the user back to login after a successful manual login.
 */
@Singleton
class UnauthorizedInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {
    companion object {
        private const val TAG = "UnauthorizedInterceptor"
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)

        // Skip auth endpoints — their callers handle 401 directly
        val path = request.url.encodedPath
        if (path.contains("/auth/")) {
            return response
        }

        if (response.code == 401) {
            // Note: We cannot safely read from DataStore here as we're on network thread.
            // We assume if we got a 401 and saved credentials exist, we should clear.
            // The TokenManager will be updated from UI thread via LoginViewModel.
            Log.w(TAG, "Got 401 response, notifying unauthorized")
            tokenManager.notifyUnauthorized()
        }
        return response
    }
}

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {
    companion object {
        private const val TAG = "AuthInterceptor"
    }

    @Volatile
    private var cachedServerUrl: String = ""

    @Volatile
    private var cachedToken: String = ""

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val host = original.url.host

        // Use cached values (updated from UI thread or initial sync)
        val serverUrl = cachedServerUrl
        val serverHost = try {
            if (serverUrl.isNotEmpty()) java.net.URL(serverUrl).host else ""
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse server URL: $serverUrl", e)
            ""
        }
        val isServerRequest = host == "localhost" || (serverHost.isNotEmpty() && host == serverHost)

        if (!isServerRequest) {
            return chain.proceed(original)
        }

        // Skip auth header for login and refresh endpoints
        val path = original.url.encodedPath
        if (path.endsWith("/auth/login") || path.endsWith("/auth/refresh")) {
            return chain.proceed(original)
        }

        val token = cachedToken

        val request = if (token.isNotEmpty()) {
            original.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            original
        }

        return chain.proceed(request)
    }

    /** Call this from UI thread (e.g., LoginViewModel) to update cached token. */
    suspend fun updateCachedCredentials() {
        cachedServerUrl = tokenManager.getServerUrl().firstOrNull() ?: ""
        cachedToken = tokenManager.getToken().firstOrNull() ?: ""
    }
}

@Singleton
class BaseUrlInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {
    companion object {
        private const val TAG = "BaseUrlInterceptor"
    }

    @Volatile
    private var cachedServerUrl: String = ""

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val serverUrl = cachedServerUrl

        if (serverUrl.isEmpty()) {
            return chain.proceed(original)
        }

        val originalUrl = original.url.toString()
        val base = serverUrl.trimEnd('/')

        // Replace placeholder base URL for both API and other server paths (images, media, etc.)
        val newUrl = originalUrl.replace("http://localhost/", "$base/")

        val request = original.newBuilder()
            .url(newUrl)
            .build()

        return chain.proceed(request)
    }

    /** Call this from UI thread to update cached server URL. */
    suspend fun updateCachedServerUrl() {
        cachedServerUrl = tokenManager.getServerUrl().firstOrNull() ?: ""
    }
}
