package com.tivify.app.ui.components

import android.content.Context
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

enum class ViewMode(val key: String) {
    COMPACT("compact"),
    NORMAL("normal"),
    LARGE("large"),
    LIST("list");

    companion object {
        fun fromKey(key: String): ViewMode =
            entries.firstOrNull { it.key == key } ?: NORMAL
    }
}

enum class ScreenType {
    CHANNELS, VOD, SERIES
}

data class GridConfig(
    val columns: GridCells,
    val contentPadding: Dp = 14.dp,
    val itemSpacing: Dp = 14.dp
)

fun ViewMode.gridConfig(screenType: ScreenType): GridConfig = when (this) {
    ViewMode.COMPACT -> when (screenType) {
        ScreenType.CHANNELS -> GridConfig(GridCells.Adaptive(minSize = 120.dp), 10.dp, 10.dp)
        ScreenType.VOD, ScreenType.SERIES -> GridConfig(GridCells.Adaptive(minSize = 100.dp), 10.dp, 10.dp)
    }
    ViewMode.NORMAL -> when (screenType) {
        ScreenType.CHANNELS -> GridConfig(GridCells.Adaptive(minSize = 170.dp))
        ScreenType.VOD, ScreenType.SERIES -> GridConfig(GridCells.Adaptive(minSize = 150.dp))
    }
    ViewMode.LARGE -> when (screenType) {
        ScreenType.CHANNELS -> GridConfig(GridCells.Adaptive(minSize = 240.dp), 16.dp, 16.dp)
        ScreenType.VOD, ScreenType.SERIES -> GridConfig(GridCells.Adaptive(minSize = 200.dp), 16.dp, 16.dp)
    }
    ViewMode.LIST -> GridConfig(GridCells.Fixed(1), 12.dp, 8.dp)
}

private val Context.viewModeDataStore by preferencesDataStore(name = "view_mode_prefs")

class ViewModePreferences(private val context: Context) {
    companion object {
        private val CHANNELS_KEY = stringPreferencesKey("view_mode_channels")
        private val VOD_KEY = stringPreferencesKey("view_mode_vod")
        private val SERIES_KEY = stringPreferencesKey("view_mode_series")
    }

    fun getViewMode(screenType: ScreenType): Flow<ViewMode> =
        context.viewModeDataStore.data.map { prefs ->
            ViewMode.fromKey(prefs[screenType.prefKey()] ?: ViewMode.NORMAL.key)
        }

    suspend fun setViewMode(screenType: ScreenType, mode: ViewMode) {
        context.viewModeDataStore.edit { prefs ->
            prefs[screenType.prefKey()] = mode.key
        }
    }

    private fun ScreenType.prefKey() = when (this) {
        ScreenType.CHANNELS -> CHANNELS_KEY
        ScreenType.VOD -> VOD_KEY
        ScreenType.SERIES -> SERIES_KEY
    }
}
