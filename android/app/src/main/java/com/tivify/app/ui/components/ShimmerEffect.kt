package com.tivify.app.ui.components

import androidx.compose.animation.core.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import com.tivify.app.ui.theme.DarkBorder
import com.tivify.app.ui.theme.DarkCard
import com.tivify.app.ui.theme.DarkSurface

@Composable
fun rememberShimmerBrush(): Brush {
    val shimmerColors = listOf(
        DarkCard,
        DarkBorder,
        DarkSurface,
        DarkBorder,
        DarkCard,
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateX by transition.animateFloat(
        initialValue = -1200f,
        targetValue = 1200f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerTranslate"
    )

    return Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateX, 0f),
        end = Offset(translateX + 600f, 600f)
    )
}
