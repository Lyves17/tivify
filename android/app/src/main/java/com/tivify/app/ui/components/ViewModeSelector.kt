package com.tivify.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.ViewList
import androidx.compose.material.icons.filled.ViewModule
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.tivify.app.ui.theme.*

@Composable
fun ViewModeSelector(
    currentMode: ViewMode,
    onModeSelected: (ViewMode) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        ViewMode.entries.forEach { mode ->
            val isSelected = mode == currentMode
            IconButton(
                onClick = { onModeSelected(mode) },
                modifier = Modifier
                    .size(36.dp)
                    .tvFocusable(shape = RoundedCornerShape(8.dp), scale = 1.1f)
                    .background(
                        color = if (isSelected) Primary600.copy(alpha = 0.3f) else Color.Transparent,
                        shape = RoundedCornerShape(8.dp)
                    )
            ) {
                Icon(
                    imageVector = mode.icon(),
                    contentDescription = mode.label(),
                    tint = if (isSelected) Primary400 else TextMuted,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

private fun ViewMode.icon(): ImageVector = when (this) {
    ViewMode.COMPACT -> Icons.Default.GridView
    ViewMode.NORMAL -> Icons.Default.Apps
    ViewMode.LARGE -> Icons.Default.ViewModule
    ViewMode.LIST -> Icons.Default.ViewList
}

private fun ViewMode.label(): String = when (this) {
    ViewMode.COMPACT -> "Compacto"
    ViewMode.NORMAL -> "Normal"
    ViewMode.LARGE -> "Grande"
    ViewMode.LIST -> "Lista"
}
