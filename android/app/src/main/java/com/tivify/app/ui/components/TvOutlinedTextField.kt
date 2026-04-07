package com.tivify.app.ui.components

import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.*
import androidx.compose.ui.text.input.VisualTransformation

/**
 * OutlinedTextField optimizado para Smart TV con D-pad.
 *
 * Comportamiento:
 * - Al recibir foco con D-pad: NO abre el teclado (readOnly = true)
 * - Al pulsar Enter / DpadCenter: abre el teclado para editar
 * - Al pulsar Back / Escape: cierra el teclado, mantiene foco en el campo
 * - Al perder foco: cierra el teclado automaticamente
 */
@Composable
fun TvOutlinedTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: @Composable (() -> Unit)? = null,
    placeholder: @Composable (() -> Unit)? = null,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    singleLine: Boolean = false,
    colors: TextFieldColors = OutlinedTextFieldDefaults.colors()
) {
    var isEditing by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    // Cuando entra en modo edicion, re-solicitar foco para que Compose
    // inicie la sesion de texto y abra el teclado virtual
    LaunchedEffect(isEditing) {
        if (isEditing) {
            focusRequester.requestFocus()
        }
    }

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        readOnly = !isEditing,
        modifier = modifier
            .focusRequester(focusRequester)
            .onPreviewKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown) {
                    when (event.key) {
                        Key.Enter, Key.DirectionCenter, Key.NumPadEnter -> {
                            if (!isEditing) {
                                isEditing = true
                                true // consumir para no insertar salto de linea
                            } else false
                        }
                        Key.Back, Key.Escape -> {
                            if (isEditing) {
                                isEditing = false
                                true // consumir Back para no salir de pantalla
                            } else false
                        }
                        else -> false
                    }
                } else false
            }
            .onFocusChanged { focusState ->
                if (!focusState.isFocused) {
                    isEditing = false
                }
            },
        label = label,
        placeholder = placeholder,
        leadingIcon = leadingIcon,
        trailingIcon = trailingIcon,
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        singleLine = singleLine,
        colors = colors
    )
}
