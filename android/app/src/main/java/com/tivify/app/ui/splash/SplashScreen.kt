package com.tivify.app.ui.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tivify.app.BuildConfig
import com.tivify.app.ui.theme.*
import kotlinx.coroutines.delay

/**
 * Pantalla splash con animacion tipo Netflix.
 *
 * Fases:
 * 1. Fade in + Scale up del logo "TIVIFY" (0-800ms)
 * 2. Resplandor indigo detras del texto (400-1200ms)
 * 3. Mantiene y fade out (1800-2500ms)
 */
@Composable
fun SplashScreen(onFinished: () -> Unit) {
    var phase by remember { mutableIntStateOf(0) } // 0=initial, 1=animating, 2=fadeout

    // Fase 1: Logo scale + fade in
    val logoScale by animateFloatAsState(
        targetValue = when (phase) {
            0 -> 0.3f
            else -> 1f
        },
        animationSpec = tween(
            durationMillis = 800,
            easing = EaseOutBack
        ),
        label = "logoScale"
    )

    val logoAlpha by animateFloatAsState(
        targetValue = when (phase) {
            0 -> 0f
            2 -> 0f
            else -> 1f
        },
        animationSpec = tween(
            durationMillis = if (phase == 2) 500 else 600
        ),
        label = "logoAlpha"
    )

    // Fase 2: Glow resplandor
    val glowAlpha by animateFloatAsState(
        targetValue = when (phase) {
            0 -> 0f
            2 -> 0f
            else -> 0.7f
        },
        animationSpec = tween(
            durationMillis = if (phase == 2) 400 else 1000,
            delayMillis = if (phase == 1) 300 else 0
        ),
        label = "glowAlpha"
    )

    // Version text fade in
    val versionAlpha by animateFloatAsState(
        targetValue = when (phase) {
            0 -> 0f
            2 -> 0f
            else -> 0.6f
        },
        animationSpec = tween(
            durationMillis = if (phase == 2) 300 else 800,
            delayMillis = if (phase == 1) 600 else 0
        ),
        label = "versionAlpha"
    )

    LaunchedEffect(Unit) {
        // Fase 1: iniciar animacion
        phase = 1
        // Mantener visible
        delay(2000)
        // Fase 2: fade out
        phase = 2
        delay(600)
        // Navegar
        onFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground),
        contentAlignment = Alignment.Center
    ) {
        // Capa glow (detras del texto principal)
        Text(
            text = "TIVIFY",
            fontSize = 56.sp,
            fontWeight = FontWeight.Bold,
            color = Primary500,
            modifier = Modifier
                .graphicsLayer {
                    scaleX = logoScale * 1.15f
                    scaleY = logoScale * 1.15f
                    alpha = glowAlpha * 0.4f
                }
                .blur(24.dp)
        )

        // Capa glow cercana
        Text(
            text = "TIVIFY",
            fontSize = 56.sp,
            fontWeight = FontWeight.Bold,
            color = FocusGlow,
            modifier = Modifier
                .graphicsLayer {
                    scaleX = logoScale * 1.05f
                    scaleY = logoScale * 1.05f
                    alpha = glowAlpha * 0.25f
                }
                .blur(12.dp)
        )

        // Texto principal
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "TIVIFY",
                fontSize = 52.sp,
                fontWeight = FontWeight.Bold,
                color = Primary500,
                modifier = Modifier.graphicsLayer {
                    scaleX = logoScale
                    scaleY = logoScale
                    alpha = logoAlpha
                }
            )

            Text(
                text = "v${BuildConfig.APP_VERSION}",
                fontSize = 14.sp,
                color = TextMuted,
                modifier = Modifier.graphicsLayer {
                    alpha = versionAlpha
                }
            )
        }
    }
}
