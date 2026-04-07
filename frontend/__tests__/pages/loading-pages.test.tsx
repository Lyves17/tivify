import React from 'react'
import { render } from '@testing-library/react'

describe('AdminLoading', () => {
  it('renders skeleton placeholders', () => {
    const AdminLoading = require('@/app/admin/loading').default
    const { container } = render(<AdminLoading />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })
})

describe('UserLoading', () => {
  it('renders skeleton placeholders', () => {
    const UserLoading = require('@/app/(user)/loading').default
    const { container } = render(<UserLoading />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })
})
