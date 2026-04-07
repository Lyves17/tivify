import { render, screen, fireEvent } from '@testing-library/react'
import FormSelect from '@/components/ui/form-select'

describe('FormSelect', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ]

  const defaultProps = {
    label: 'Category',
    name: 'category',
    value: '',
    onChange: jest.fn(),
    options,
  }

  it('renders label and select', () => {
    render(<FormSelect {...defaultProps} />)
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders default placeholder option', () => {
    render(<FormSelect {...defaultProps} />)
    expect(screen.getByText('Seleccionar...')).toBeInTheDocument()
  })

  it('renders all options', () => {
    render(<FormSelect {...defaultProps} />)
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('calls onChange when selecting', () => {
    const onChange = jest.fn()
    render(<FormSelect {...defaultProps} onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('shows error message', () => {
    render(<FormSelect {...defaultProps} error="Required" />)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('can be disabled', () => {
    render(<FormSelect {...defaultProps} disabled />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
