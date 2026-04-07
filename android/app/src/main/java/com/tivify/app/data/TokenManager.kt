package com.tivify.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import com.google.gson.reflect.TypeToken
import com.tivify.app.data.api.UserData
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.map
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "tivify_prefs")

data class SavedAccount(val serverUrl: String, val username: String)

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private val ACCESS_TOKEN = stringPreferencesKey("access_token")
        private val SERVER_URL = stringPreferencesKey("server_url")
        private val USER_JSON = stringPreferencesKey("user_json")
        private val SAVED_ACCOUNTS_JSON = stringPreferencesKey("saved_accounts")
        private val SAVED_SERVERS_JSON = stringPreferencesKey("saved_servers")
    }

    private val gson = Gson()

    // --- Session expiry notification ---
    private val _unauthorizedEvent = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val unauthorizedEvent: SharedFlow<Unit> = _unauthorizedEvent.asSharedFlow()

    /** Called from UnauthorizedInterceptor when a 401 is received mid-session. */
    fun notifyUnauthorized() {
        _unauthorizedEvent.tryEmit(Unit)
    }

    // --- Auth data ---

    fun getToken(): Flow<String?> = context.dataStore.data.map { it[ACCESS_TOKEN] }

    fun getServerUrl(): Flow<String?> = context.dataStore.data.map { it[SERVER_URL] }

    fun getUser(): Flow<UserData?> = context.dataStore.data.map { prefs ->
        prefs[USER_JSON]?.let { json ->
            if (json.isBlank()) {
                null
            } else {
                try {
                    gson.fromJson(json, UserData::class.java)
                } catch (e: JsonSyntaxException) {
                    Timber.w(e, "Failed to deserialize user JSON")
                    null
                } catch (e: Exception) {
                    Timber.w(e, "Unexpected error deserializing user")
                    null
                }
            }
        }
    }

    // --- Saved accounts ---

    fun getSavedAccounts(): Flow<List<SavedAccount>> = context.dataStore.data.map { prefs ->
        val json = prefs[SAVED_ACCOUNTS_JSON] ?: return@map emptyList()
        if (json.isBlank()) return@map emptyList()
        try {
            val type = object : TypeToken<List<SavedAccount>>() {}.type
            gson.fromJson<List<SavedAccount>>(json, type)?.takeIf { it.isNotEmpty() } ?: emptyList()
        } catch (e: JsonSyntaxException) {
            Timber.w(e, "Failed to deserialize saved accounts JSON")
            emptyList()
        } catch (e: Exception) {
            Timber.w(e, "Unexpected error deserializing saved accounts")
            emptyList()
        }
    }

    // --- Saved servers (unique URLs) ---

    fun getSavedServers(): Flow<List<String>> = context.dataStore.data.map { prefs ->
        val json = prefs[SAVED_SERVERS_JSON] ?: return@map emptyList()
        if (json.isBlank()) return@map emptyList()
        try {
            val type = object : TypeToken<List<String>>() {}.type
            gson.fromJson<List<String>>(json, type)?.takeIf { it.isNotEmpty() } ?: emptyList()
        } catch (e: JsonSyntaxException) {
            Timber.w(e, "Failed to deserialize saved servers JSON")
            emptyList()
        } catch (e: Exception) {
            Timber.w(e, "Unexpected error deserializing saved servers")
            emptyList()
        }
    }

    // --- Write operations ---

    suspend fun saveToken(token: String) {
        context.dataStore.edit { it[ACCESS_TOKEN] = token }
    }

    suspend fun saveServerUrl(url: String) {
        context.dataStore.edit { it[SERVER_URL] = url }
    }

    suspend fun saveUser(user: UserData) {
        context.dataStore.edit { it[USER_JSON] = gson.toJson(user) }
    }

    /** Persist a server+username pair (max 10, most recent first, no duplicates). */
    suspend fun saveAccount(serverUrl: String, username: String) {
        context.dataStore.edit { prefs ->
            val json = prefs[SAVED_ACCOUNTS_JSON]
            val type = object : TypeToken<MutableList<SavedAccount>>() {}.type
            val list: MutableList<SavedAccount> = if (!json.isNullOrEmpty()) {
                try {
                    gson.fromJson<MutableList<SavedAccount>>(json, type) ?: mutableListOf()
                } catch (e: JsonSyntaxException) {
                    Timber.w(e, "Failed to deserialize saved accounts in saveAccount")
                    mutableListOf()
                } catch (e: Exception) {
                    Timber.w(e, "Unexpected error in saveAccount")
                    mutableListOf()
                }
            } else { mutableListOf() }
            list.removeAll { it.serverUrl == serverUrl && it.username == username }
            list.add(0, SavedAccount(serverUrl, username))
            if (list.size > 10) list.subList(10, list.size).clear()
            prefs[SAVED_ACCOUNTS_JSON] = gson.toJson(list)
        }
    }

    /** Persist a server URL (max 10, most recent first, no duplicates). */
    suspend fun saveServer(url: String) {
        context.dataStore.edit { prefs ->
            val json = prefs[SAVED_SERVERS_JSON]
            val type = object : TypeToken<MutableList<String>>() {}.type
            val list: MutableList<String> = if (!json.isNullOrEmpty()) {
                try {
                    gson.fromJson<MutableList<String>>(json, type) ?: mutableListOf()
                } catch (e: JsonSyntaxException) {
                    Timber.w(e, "Failed to deserialize saved servers in saveServer")
                    mutableListOf()
                } catch (e: Exception) {
                    Timber.w(e, "Unexpected error in saveServer")
                    mutableListOf()
                }
            } else { mutableListOf() }
            list.remove(url)
            list.add(0, url)
            if (list.size > 10) list.subList(10, list.size).clear()
            prefs[SAVED_SERVERS_JSON] = gson.toJson(list)
        }
    }

    /** Remove a server URL from the saved list. */
    suspend fun removeServer(url: String) {
        context.dataStore.edit { prefs ->
            val json = prefs[SAVED_SERVERS_JSON]
            val type = object : TypeToken<MutableList<String>>() {}.type
            val list: MutableList<String> = if (!json.isNullOrEmpty()) {
                try {
                    gson.fromJson<MutableList<String>>(json, type) ?: mutableListOf()
                } catch (e: JsonSyntaxException) {
                    Timber.w(e, "Failed to deserialize saved servers in removeServer")
                    mutableListOf()
                } catch (e: Exception) {
                    Timber.w(e, "Unexpected error in removeServer")
                    mutableListOf()
                }
            } else { mutableListOf() }
            list.remove(url)
            prefs[SAVED_SERVERS_JSON] = gson.toJson(list)
        }
    }

    /** Clear auth credentials but preserve saved servers and saved accounts. */
    suspend fun clear() {
        context.dataStore.edit { prefs ->
            // Preserve saved servers and accounts before clearing
            val savedServers = prefs[SAVED_SERVERS_JSON]
            val savedAccounts = prefs[SAVED_ACCOUNTS_JSON]
            prefs.clear()
            // Restore preserved data
            if (savedServers != null) prefs[SAVED_SERVERS_JSON] = savedServers
            if (savedAccounts != null) prefs[SAVED_ACCOUNTS_JSON] = savedAccounts
        }
    }
}
