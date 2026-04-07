package com.tivify.app.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.tivify.app.ui.theme.FocusGlow

/**
 * Modifier that adds visual focus feedback for D-pad / TV remote navigation.
 * When focused: bright border + scale up + shadow glow + smooth animation.
 * When unfocused: no border, normal scale.
 */
fun Modifier.tvFocusable(
    shape: Shape = RoundedCornerShape(12.dp),
    scale: Float = 1.08f,
    borderWidth: Dp = 3.dp
) = composed {
    var isFocused by remember { mutableStateOf(false) }

    val animatedScale by animateFloatAsState(
        targetValue = if (isFocused) scale else 1f,
        animationSpec = tween(durationMillis = 150, easing = FastOutSlowInEasing),
        label = "focusScale"
    )

    this
        .onFocusChanged { isFocused = it.isFocused }
        .graphicsLayer {
            scaleX = animatedScale
            scaleY = animatedScale
            if (isFocused) {
                shadowElevation = 12f
                this.shape = shape
                clip = false
            }
        }
        .then(
            if (isFocused) Modifier.border(borderWidth, FocusGlow, shape)
            else Modifier
        )
        .focusable()
}
