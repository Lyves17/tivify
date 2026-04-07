/**
 * Input validation and sanitization utilities
 */

/**
 * Validate if a string is a valid URL
 * @param url The URL string to validate
 * @returns true if valid URL format
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate if a string is a valid email
 * @param email The email string to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate if a password meets minimum requirements
 * @param password The password to validate
 * @returns object with validation result and specific failures
 */
export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Sanitize text by removing HTML tags and dangerous characters
 * @param text The text to sanitize
 * @returns sanitized text
 */
export function sanitizeText(text: string): string {
  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '')
  // Decode HTML entities to prevent double encoding
  sanitized = sanitized
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
  return sanitized.trim()
}

/**
 * Validate text input (non-empty, reasonable length)
 * @param text The text to validate
 * @param minLength Minimum length (default: 1)
 * @param maxLength Maximum length (default: 1000)
 * @returns true if valid
 */
export function isValidText(
  text: string,
  minLength = 1,
  maxLength = 1000
): boolean {
  const sanitized = sanitizeText(text)
  return sanitized.length >= minLength && sanitized.length <= maxLength
}

/**
 * Validate a channel name
 * @param name The channel name to validate
 * @returns object with validation result
 */
export function validateChannelName(name: string): {
  isValid: boolean
  error?: string
} {
  if (!isValidText(name, 1, 100)) {
    return {
      isValid: false,
      error: 'El nombre del canal debe tener entre 1 y 100 caracteres',
    }
  }
  return { isValid: true }
}

/**
 * Validate a category name
 * @param name The category name to validate
 * @returns object with validation result
 */
export function validateCategoryName(name: string): {
  isValid: boolean
  error?: string
} {
  if (!isValidText(name, 1, 100)) {
    return {
      isValid: false,
      error: 'El nombre de la categoría debe tener entre 1 y 100 caracteres',
    }
  }
  return { isValid: true }
}

/**
 * Validate a VOD title
 * @param title The VOD title to validate
 * @returns object with validation result
 */
export function validateVODTitle(title: string): {
  isValid: boolean
  error?: string
} {
  if (!isValidText(title, 1, 255)) {
    return {
      isValid: false,
      error: 'El título debe tener entre 1 y 255 caracteres',
    }
  }
  return { isValid: true }
}

/**
 * Validate a description
 * @param description The description to validate
 * @returns object with validation result
 */
export function validateDescription(description: string): {
  isValid: boolean
  error?: string
} {
  if (!isValidText(description, 0, 5000)) {
    return {
      isValid: false,
      error: 'La descripción debe tener menos de 5000 caracteres',
    }
  }
  return { isValid: true }
}

/**
 * Validate a stream URL
 * @param url The stream URL to validate
 * @returns object with validation result
 */
export function validateStreamURL(url: string): {
  isValid: boolean
  error?: string
} {
  if (!isValidURL(url)) {
    return {
      isValid: false,
      error: 'Formato de URL inválido',
    }
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return {
      isValid: false,
      error: 'La URL debe empezar con http:// o https://',
    }
  }
  return { isValid: true }
}

/**
 * Validate a username
 * @param username The username to validate
 * @returns object with validation result
 */
export function validateUsername(username: string): {
  isValid: boolean
  error?: string
} {
  if (!isValidText(username, 3, 32)) {
    return {
      isValid: false,
      error: 'El nombre de usuario debe tener entre 3 y 32 caracteres',
    }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      isValid: false,
      error: 'El nombre de usuario solo puede contener letras, números, guiones bajos y guiones',
    }
  }
  return { isValid: true }
}
