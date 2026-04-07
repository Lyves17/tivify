import { render, screen, fireEvent } from '@testing-library/react'
import FormTextarea from '@/components/ui/form-textarea'

describe('FormTextarea', () => {
  const defaultProps = {
    label: 'Description',
    name: 'description',
    value: '',
    onChange: jest.fn(),
  }

  it('renders label and textarea', () => {
    render(<FormTextarea {...defaultProps} />)
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('uses 4 rows by default', () => {
    render(<FormTextarea {...defaultProps} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4')
  })

  it('supports custom rows', () => {
    render(<FormTextarea {...defaultProps} rows={8} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '8')
  })

  it('calls onChange when typing', () => {
    const onChange = jest.fn()
    render(<FormTextarea {...defaultProps} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('shows error message', () => {
    render(<FormTextarea {...defaultProps} error="Too long" />)
    expect(screen.getByText('Too long')).toBeInTheDocument()
  })

  it('can be disabled', () => {
    render(<FormTextarea {...defaultProps} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
