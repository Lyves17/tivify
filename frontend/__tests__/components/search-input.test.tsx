import { render, screen, fireEvent, act } from '@testing-library/react'
import SearchInput from '@/components/ui/search-input'

describe('SearchInput', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders with placeholder', () => {
    render(<SearchInput value="" onChange={jest.fn()} />)
    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument()
  })

  it('renders with custom placeholder', () => {
    render(<SearchInput value="" onChange={jest.fn()} placeholder="Search..." />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('displays current value', () => {
    render(<SearchInput value="test" onChange={jest.fn()} />)
    expect(screen.getByDisplayValue('test')).toBeInTheDocument()
  })

  it('debounces onChange calls', () => {
    const onChange = jest.fn()
    render(<SearchInput value="" onChange={onChange} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(onChange).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('cancels previous debounce on new input', () => {
    const onChange = jest.fn()
    render(<SearchInput value="" onChange={onChange} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'he' } })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('has aria-label', () => {
    render(<SearchInput value="" onChange={jest.fn()} placeholder="Search channels" />)
    expect(screen.getByLabelText('Search channels')).toBeInTheDocument()
  })
})
