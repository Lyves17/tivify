import { render, screen, fireEvent } from '@testing-library/react'
import FormInput from '@/components/ui/form-input'

describe('FormInput', () => {
  const defaultProps = {
    label: 'Username',
    name: 'username',
    value: '',
    onChange: jest.fn(),
  }

  it('renders label and input', () => {
    render(<FormInput {...defaultProps} />)
    expect(screen.getByText('Username')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('uses text type by default', () => {
    render(<FormInput {...defaultProps} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text')
  })

  it('supports custom type', () => {
    render(<FormInput {...defaultProps} type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
  })

  it('calls onChange when typing', () => {
    const onChange = jest.fn()
    render(<FormInput {...defaultProps} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('shows placeholder', () => {
    render(<FormInput {...defaultProps} placeholder="Enter name" />)
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<FormInput {...defaultProps} error="Required field" />)
    expect(screen.getByText('Required field')).toBeInTheDocument()
  })

  it('can be disabled', () => {
    render(<FormInput {...defaultProps} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('shows required indicator', () => {
    render(<FormInput {...defaultProps} required />)
    expect(screen.getByText('*')).toBeInTheDocument()
  })
})
