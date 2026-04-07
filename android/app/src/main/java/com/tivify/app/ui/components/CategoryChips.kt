package com.tivify.app.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.unit.dp
import com.tivify.app.data.api.CategoryData
import com.tivify.app.ui.theme.*

@Composable
fun CategoryChips(
    categories: List<CategoryData>,
    selectedId: Int?,
    onSelect: (Int?) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyRow(
        modifier = modifier,
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            FocusableChip(
                selected = selectedId == null,
                onClick = { onSelect(null) },
                label = "Todos"
            )
        }
        items(categories) { category ->
            FocusableChip(
                selected = selectedId == category.id,
                onClick = { onSelect(category.id) },
                label = category.name
            )
        }
    }
}

@Composable
private fun FocusableChip(selected: Boolean, onClick: () -> Unit, label: String) {
    var isFocused by remember { mutableStateOf(false) }
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        colors = chipColors(),
        modifier = Modifier
            .onFocusChanged { isFocused = it.isFocused }
            .then(
                if (isFocused) Modifier.border(2.dp, Primary500, RoundedCornerShape(8.dp))
                else Modifier
            )
            .focusable()
    )
}

@Composable
private fun chipColors() = FilterChipDefaults.filterChipColors(
    selectedContainerColor = Primary600,
    selectedLabelColor = TextPrimary,
    containerColor = DarkCard,
    labelColor = TextSecondary
)
