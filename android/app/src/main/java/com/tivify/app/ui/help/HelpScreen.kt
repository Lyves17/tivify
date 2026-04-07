package com.tivify.app.ui.help

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tivify.app.ui.components.tvFocusable
import com.tivify.app.ui.theme.*

private data class FaqItem(val question: String, val answer: String)

private val faqItems = listOf(
    FaqItem(
        "Como ver canales en vivo?",
        "Navega a la seccion 'Canales' desde la barra inferior. Selecciona el canal que deseas ver y la reproduccion comenzara automaticamente."
    ),
    FaqItem(
        "Como agregar contenido a favoritos?",
        "En la pagina de detalle de cualquier pelicula o serie, pulsa el icono de corazon para agregarlo a tus favoritos. Puedes ver todos tus favoritos desde la seccion 'Favoritos' en tu perfil."
    ),
    FaqItem(
        "Que es la Guia EPG?",
        "La Guia EPG (Electronic Program Guide) muestra la programacion televisiva de los canales. Puedes ver que programa se esta emitiendo ahora y la programacion futura, filtrada por dia."
    ),
    FaqItem(
        "El video no carga o se detiene",
        "Verifica tu conexion a internet. Si el problema persiste, prueba con otro canal o contenido. Algunos streams pueden estar temporalmente no disponibles. Si ningun contenido funciona, contacta al administrador del servidor."
    ),
    FaqItem(
        "Como cambiar mi contrasena?",
        "Ve a tu perfil pulsando el icono de persona en la barra inferior. En la seccion 'Cambiar contrasena', introduce tu contrasena actual y la nueva. La nueva contrasena debe tener al menos 6 caracteres."
    ),
    FaqItem(
        "Como funciona el historial?",
        "Tu historial de reproduccion se guarda automaticamente. Cuando dejas de ver una pelicula o episodio, el progreso se guarda. La proxima vez que entres, podras continuar desde donde lo dejaste con la seccion 'Seguir Viendo' del inicio."
    ),
    FaqItem(
        "Que formatos de video soporta?",
        "La plataforma soporta reproduccion HLS (HTTP Live Streaming) y reproduccion directa de archivos de video. Los contenidos locales se transcodifican automaticamente al formato adecuado."
    )
)

@Composable
fun HelpScreen(onBack: () -> Unit) {
    var expandedIndex by remember { mutableIntStateOf(-1) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.tvFocusable(shape = RoundedCornerShape(24.dp))
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver", tint = TextPrimary)
            }
            Text(
                text = "Ayuda",
                color = TextPrimary,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
        }

        Text(
            text = "Preguntas frecuentes sobre el uso de la plataforma.",
            color = TextMuted,
            fontSize = 14.sp
        )

        Spacer(modifier = Modifier.height(4.dp))

        // FAQ items
        faqItems.forEachIndexed { index, item ->
            val isExpanded = expandedIndex == index

            Card(
                colors = CardDefaults.cardColors(containerColor = DarkCard),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.tvFocusable(shape = RoundedCornerShape(12.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable {
                                expandedIndex = if (isExpanded) -1 else index
                            },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = item.question,
                            color = TextPrimary,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                            modifier = Modifier.weight(1f)
                        )
                        Icon(
                            if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                            contentDescription = null,
                            tint = if (isExpanded) Primary400 else TextMuted
                        )
                    }

                    AnimatedVisibility(
                        visible = isExpanded,
                        enter = expandVertically(),
                        exit = shrinkVertically()
                    ) {
                        Column {
                            Spacer(modifier = Modifier.height(12.dp))
                            HorizontalDivider(color = DarkBorder)
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = item.answer,
                                color = TextSecondary,
                                fontSize = 15.sp,
                                lineHeight = 22.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
