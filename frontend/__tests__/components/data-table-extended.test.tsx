/**
 * Extended tests for DataTable — covers the fallback "—" when column key
 * is missing from item and no render function is provided (line 97 branch).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import DataTable from '@/components/ui/data-table'

describe('DataTable - fallback dash for missing keys', () => {
  it('renders "—" when item does not have the column key and no render function', () => {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
    ]
    // Data has 'name' but not 'email'
    const data = [{ name: 'Alice' }]

    render(<DataTable columns={columns} data={data as any} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    // The missing 'email' should show the fallback dash
    const cells = screen.getAllByRole('cell')
    // First cell: Alice, Second cell: —
    expect(cells[1].textContent).toBe('—')
  })

  it('renders null/undefined values as "—"', () => {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
    ]
    const data = [{ name: 'Bob', status: null }]

    render(<DataTable columns={columns} data={data as any} />)

    const cells = screen.getAllByRole('cell')
    expect(cells[1].textContent).toBe('—')
  })
})
