import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import HelpPage from '@/app/(user)/help/page'

describe('HelpPage', () => {
  beforeEach(() => {
    i18n.changeLanguage('es')
  })

  it('renders page title', () => {
    render(<HelpPage />)
    expect(screen.getByText('Ayuda')).toBeInTheDocument()
  })

  it('renders subtitle', () => {
    render(<HelpPage />)
    expect(screen.getByText('Preguntas frecuentes sobre el uso de la plataforma.')).toBeInTheDocument()
  })

  it('renders all 7 FAQ questions', () => {
    render(<HelpPage />)

    expect(screen.getByText('Como ver canales en vivo?')).toBeInTheDocument()
    expect(screen.getByText('Como agregar contenido a favoritos?')).toBeInTheDocument()
    expect(screen.getByText('Que es la Guia EPG?')).toBeInTheDocument()
    expect(screen.getByText('El video no carga o se detiene')).toBeInTheDocument()
    expect(screen.getByText('Como cambiar mi contrasena?')).toBeInTheDocument()
    expect(screen.getByText('Como funciona el historial?')).toBeInTheDocument()
    expect(screen.getByText('Que formatos de video soporta la plataforma?')).toBeInTheDocument()
  })

  it('does not show any answers initially', () => {
    render(<HelpPage />)

    // Answers should not be visible before clicking
    expect(screen.queryByText(/Navega a la seccion/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/En la pagina de detalle/i)).not.toBeInTheDocument()
  })

  it('shows answer when clicking a question', () => {
    render(<HelpPage />)

    fireEvent.click(screen.getByText('Como ver canales en vivo?'))

    expect(screen.getByText(/Navega a la seccion/i)).toBeInTheDocument()
  })

  it('hides answer when clicking the same question again', () => {
    render(<HelpPage />)

    // Open
    fireEvent.click(screen.getByText('Como ver canales en vivo?'))
    expect(screen.getByText(/Navega a la seccion/i)).toBeInTheDocument()

    // Close
    fireEvent.click(screen.getByText('Como ver canales en vivo?'))
    expect(screen.queryByText(/Navega a la seccion/i)).not.toBeInTheDocument()
  })

  it('closes previous answer when opening a different question', () => {
    render(<HelpPage />)

    // Open first question
    fireEvent.click(screen.getByText('Como ver canales en vivo?'))
    expect(screen.getByText(/Navega a la seccion/i)).toBeInTheDocument()

    // Open second question
    fireEvent.click(screen.getByText('Como agregar contenido a favoritos?'))

    // First answer should be hidden
    expect(screen.queryByText(/Navega a la seccion/i)).not.toBeInTheDocument()

    // Second answer should be visible
    expect(screen.getByText(/En la pagina de detalle/i)).toBeInTheDocument()
  })

  it('shows all FAQ answers when toggled open sequentially', () => {
    render(<HelpPage />)

    // Each question can be opened and shows its answer
    const questions = [
      { q: 'Como ver canales en vivo?', aPattern: /Navega a la seccion/ },
      { q: 'Como agregar contenido a favoritos?', aPattern: /En la pagina de detalle/ },
      { q: 'Que es la Guia EPG?', aPattern: /Electronic Program Guide/ },
      { q: 'El video no carga o se detiene', aPattern: /Verifica tu conexion/ },
      { q: 'Como cambiar mi contrasena?', aPattern: /Ve a 'Ajustes'/ },
      { q: 'Como funciona el historial?', aPattern: /Tu historial de reproduccion/ },
      { q: 'Que formatos de video soporta la plataforma?', aPattern: /HLS.*HTTP Live Streaming/ },
    ]

    questions.forEach(({ q, aPattern }) => {
      fireEvent.click(screen.getByText(q))
      expect(screen.getByText(aPattern)).toBeInTheDocument()
    })
  })

  it('renders in English when language is switched', async () => {
    i18n.changeLanguage('en')

    render(<HelpPage />)

    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })
  })
})
