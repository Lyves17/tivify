import { render, screen } from '@testing-library/react'
import FormField from '@/components/ui/form-field'

describe('FormField', () => {
  it('renders label and children', () => {
    render(
      <FormField label="Username" name="username">
        <input id="username" />
      </FormField>
    )
    expect(screen.getByText('Username')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows required indicator', () => {
    render(
      <FormField label="Email" name="email" required>
        <input id="email" />
      </FormField>
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('does not show required indicator by default', () => {
    render(
      <FormField label="Name" name="name">
        <input id="name" />
      </FormField>
    )
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('shows error message', () => {
    render(
      <FormField label="Name" name="name" error="Field is required">
        <input id="name" />
      </FormField>
    )
    expect(screen.getByText('Field is required')).toBeInTheDocument()
  })

  it('does not show error when none provided', () => {
    render(
      <FormField label="Name" name="name">
        <input id="name" />
      </FormField>
    )
    const errorElements = screen.queryAllByText(/required/i)
    expect(errorElements).toHaveLength(0)
  })

  it('label has htmlFor pointing to name', () => {
    render(
      <FormField label="Field" name="myField">
        <input id="myField" />
      </FormField>
    )
    const label = screen.getByText('Field')
    expect(label).toHaveAttribute('for', 'myField')
  })
})
