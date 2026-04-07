package com.tivify.app.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tivify.app.ui.theme.*

@Composable
fun LoadingState(
    isLoading: Boolean,
    error: String?,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    loadingContent: @Composable () -> Unit = {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Primary500)
        }
    },
    content: @Composable () -> Unit
) {
    Box(modifier = modifier.fillMaxSize()) {
        AnimatedVisibility(
            visible = isLoading,
            enter = fadeIn(tween(150)),
            exit = fadeOut(tween(200))
        ) {
            loadingContent()
        }

        AnimatedVisibility(
            visible = !isLoading && error != null,
            enter = fadeIn(tween(200)),
            exit = fadeOut(tween(150))
        ) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = error ?: "", color = LiveRed, modifier = Modifier.padding(16.dp))
                    Button(
                        onClick = onRetry,
                        colors = ButtonDefaults.buttonColors(containerColor = Primary600),
                        modifier = Modifier.tvFocusable(shape = RoundedCornerShape(8.dp))
                    ) {
                        Text("Reintentar", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                }
            }
        }

        AnimatedVisibility(
            visible = !isLoading && error == null,
            enter = fadeIn(tween(280)) + slideInVertically(
                initialOffsetY = { it / 14 },
                animationSpec = tween(280)
            ),
            exit = fadeOut(tween(150))
        ) {
            content()
        }
    }
}
