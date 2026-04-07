import { render, screen } from '@testing-library/react'
import DataTable from '@/components/ui/data-table'

type TestRow = { id: number; name: string; status: string }

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
]

const data: TestRow[] = [
  { id: 1, name: 'Alice', status: 'active' },
  { id: 2, name: 'Bob', status: 'inactive' },
]

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('renders data rows', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('shows empty message when no data', () => {
    render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByText('No hay datos disponibles')).toBeInTheDocument()
  })

  it('shows custom empty message', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="No results found" />)
    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    render(<DataTable columns={columns} data={[]} loading />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('ID')).toBeInTheDocument()
  })

  it('supports custom render function', () => {
    const customColumns = [
      { key: 'name', label: 'Name', render: (item: TestRow) => <strong>{item.name}</strong> },
    ]
    render(<DataTable columns={customColumns} data={data} />)
    const strongElements = screen.getAllByText(/Alice|Bob/)
    expect(strongElements.length).toBeGreaterThan(0)
  })

  it('renders table with proper role', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
