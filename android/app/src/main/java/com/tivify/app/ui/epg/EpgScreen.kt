package com.tivify.app.ui.epg

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.tivify.app.data.api.EpgEntry
import com.tivify.app.ui.components.tvFocusable
import com.tivify.app.ui.theme.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

@OptIn(ExperimentalMaterial3Api::class)

@Composable
fun EpgScreen(
    onBack: () -> Unit = {},
    viewModel: EpgViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 4.dp, top = 8.dp, end = 16.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.tvFocusable(shape = RoundedCornerShape(24.dp))
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver", tint = TextPrimary)
            }
            Text(
                text = "Guia EPG",
                color = TextPrimary,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
        }

        // Channel selector
        if (state.channels.isNotEmpty()) {
            var expanded by remember { mutableStateOf(false) }
            val selectedChannel = state.channels.find { it.id == state.selectedChannelId }

            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                OutlinedTextField(
                    value = selectedChannel?.name ?: "Seleccionar canal",
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = Primary500,
                        unfocusedBorderColor = DarkBorder
                    )
                )

                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false },
                    containerColor = DarkSurface
                ) {
                    state.channels.forEach { channel ->
                        DropdownMenuItem(
                            text = { Text(channel.name, color = TextPrimary) },
                            onClick = {
                                viewModel.selectChannel(channel.id)
                                expanded = false
                            }
                        )
                    }
                }
            }
        }

        // Date selector
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val today = LocalDate.now()
            (-1..2).forEach { offset ->
                val date = today.plusDays(offset.toLong())
                val label = when (offset) {
                    -1 -> "Ayer"
                    0 -> "Hoy"
                    1 -> "Manana"
                    else -> date.format(DateTimeFormatter.ofPattern("dd/MM"))
                }
                FilterChip(
                    selected = state.selectedDate == date,
                    onClick = { viewModel.selectDate(date) },
                    label = { Text(label) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Primary600,
                        selectedLabelColor = TextPrimary,
                        containerColor = DarkCard,
                        labelColor = TextSecondary
                    )
                )
            }
        }

        // EPG entries
        if (state.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary500)
            }
        } else if (state.entries.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Sin programacion disponible", color = TextSecondary)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(state.entries) { entry ->
                    EpgEntryRow(entry)
                }
            }
        }
    }
}

@Composable
private fun EpgEntryRow(entry: EpgEntry) {
    val now = LocalDateTime.now()
    val start = parseDateTime(entry.startTime)
    val end = parseDateTime(entry.endTime)
    val isCurrent = start != null && end != null && now.isAfter(start) && now.isBefore(end)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .tvFocusable(shape = RoundedCornerShape(8.dp))
            .clip(RoundedCornerShape(8.dp))
            .background(if (isCurrent) Primary600.copy(alpha = 0.2f) else DarkCard)
            .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Time column
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = formatTime(entry.startTime),
                color = if (isCurrent) Primary400 else TextSecondary,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = formatTime(entry.endTime),
                color = TextMuted,
                fontSize = 13.sp
            )
        }

        // Divider
        if (isCurrent) {
            Box(
                modifier = Modifier
                    .width(3.dp)
                    .height(40.dp)
                    .background(Primary500, RoundedCornerShape(2.dp))
            )
        }

        // Info
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = entry.title,
                color = if (isCurrent) TextPrimary else TextSecondary,
                fontSize = 16.sp,
                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium
            )
            if (entry.description.isNotBlank()) {
                Text(
                    text = entry.description,
                    color = TextMuted,
                    fontSize = 14.sp,
                    maxLines = 2
                )
            }
        }
    }
}

private fun parseDateTime(dateStr: String): LocalDateTime? {
    return try {
        LocalDateTime.parse(dateStr, DateTimeFormatter.ISO_DATE_TIME)
    } catch (_: DateTimeParseException) {
        try {
            LocalDateTime.parse(dateStr, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
        } catch (_: DateTimeParseException) {
            null
        }
    }
}

private fun formatTime(dateStr: String): String {
    val dt = parseDateTime(dateStr)
    return dt?.format(DateTimeFormatter.ofPattern("HH:mm")) ?: "--:--"
}
