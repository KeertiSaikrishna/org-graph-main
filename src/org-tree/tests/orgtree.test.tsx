import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import OrgTree from '../OrgTree'
import { Employee } from '../../services/types'
import axios from 'axios'
import { notification } from 'antd'
import * as elkUtils from '../utils/elkUtils'

// Mock dependencies
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    notification: {
      error: vi.fn(),
      info: vi.fn(),
    },
    Select: ({ value, onChange, options, className }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; className: string }) =>
      React.createElement(
        'select',
        {
          'data-testid': 'team-filter',
          className,
          value,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            onChange(e.target.value),
        },
        options.map((opt: { value: string; label: string }) =>
          React.createElement('option', { key: opt.value, value: opt.value }, opt.label)
        )
      ),
    Skeleton: {
      Node: ({ style, className }: { style: React.CSSProperties; className: string }) =>
        React.createElement('div', {
          'data-testid': 'skeleton-node',
          style,
          className,
        }),
    },
  }
})

vi.mock('../utils/elkUtils', () => ({
  calculateOrgChartLayout: vi.fn(),
}))

const createEmployee = (
  id: string,
  name: string,
  designation: string,
  team: string,
  managerId: string = ''
): Employee => ({
  id,
  name,
  designation,
  team,
  managerId,
})

const createMockLayout = (employees: Employee[]) => ({
  id: 'root',
  width: 1000,
  height: 800,
  children: employees.map((emp, index) => ({
    id: emp.id,
    x: index * 250,
    y: index * 100,
    width: 220,
    height: 80,
  })),
  edges: employees
    .filter((emp) => emp.managerId)
    .map((emp) => ({
      id: `edge-${emp.managerId}-${emp.id}`,
      sources: [emp.managerId],
      targets: [emp.id],
    })),
})

describe('OrgTree Component', () => {
  const mockAxiosGet = vi.mocked(axios.get)
  const mockAxiosPatch = vi.mocked(axios.patch)
  const mockCalculateLayout = vi.mocked(elkUtils.calculateOrgChartLayout)

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock for axios.get
    mockAxiosGet.mockResolvedValue({
      data: { employees: [] },
    } as { data: { employees: Employee[] } })
    // Default mock for axios.patch
    mockAxiosPatch.mockResolvedValue({ data: {} } as unknown)
    // Default mock for layout calculation
    mockCalculateLayout.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Render & Component Mounting', () => {
    test('renders the component without crashing', () => {
      render(<OrgTree />)
      expect(screen.getByText('Employees')).toBeInTheDocument()
    })

    test('renders sidebar with "Employees" heading', () => {
      render(<OrgTree />)
      expect(screen.getByText('Employees')).toBeInTheDocument()
    })

    test('renders search input with correct placeholder', () => {
      render(<OrgTree />)
      const searchInput = screen.getByPlaceholderText(
        'Search by name, designation, or team...'
      )
      expect(searchInput).toBeInTheDocument()
    })

    test('renders team filter dropdown', () => {
      render(<OrgTree />)
      expect(screen.getByTestId('team-filter')).toBeInTheDocument()
    })

    test('renders chart container', () => {
      render(<OrgTree />)
      const chartContainer = document.querySelector('.chart-container')
      expect(chartContainer).toBeInTheDocument()
    })

    test('shows loading skeleton when isLoading is true', async () => {
      mockAxiosGet.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: { employees: [] } } as unknown), 100)
          })
      )

      render(<OrgTree />)
      const skeletons = screen.getAllByTestId('skeleton-node')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Data Fetching (fetchEmployees)', () => {
    test('calls /api/employees on component mount', async () => {
      render(<OrgTree />)
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledWith('/api/employees')
      })
    })

    test('sets employees state with fetched data', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane Smith', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
    })

    test('handles empty response (sets employees to empty array)', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { employees: [] },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        const employeeList = document.querySelector('.employee-list')
        expect(employeeList?.children.length).toBe(0)
      })
    })

    test('handles response with response.data.employees structure', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })

    test('shows error notification on fetch failure', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network error'))

      render(<OrgTree />)
      await waitFor(() => {
        expect(notification.error).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error fetching employees',
            description: 'Please try again later',
          })
        )
      })
    })

    test('error notification has correct title and description', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network error'))

      render(<OrgTree />)
      await waitFor(() => {
        expect(notification.error).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error fetching employees',
            description: 'Please try again later',
            duration: 2000,
          })
        )
      })
    })
  })

  describe('Teams Computation', () => {
    test('extracts unique teams from employees array', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane', 'CTO', 'Technology', '1'),
        createEmployee('3', 'Bob', 'CFO', 'Finance', '1'),
        createEmployee('4', 'Alice', 'VP', 'Technology', '2'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        const teamFilter = screen.getByTestId('team-filter')
        const options = teamFilter.querySelectorAll('option')
        const teamValues = Array.from(options).map((opt) => opt.textContent)
        expect(teamValues).toContain('Executive')
        expect(teamValues).toContain('Technology')
        expect(teamValues).toContain('Finance')
      })
    })

    test('handles employees with empty/null team values', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', '', ''),
        createEmployee('2', 'Jane', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        expect(screen.getByText('John')).toBeInTheDocument()
      })
    })

    test('handles empty employees array (returns empty teams array)', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { employees: [] },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        const teamFilter = screen.getByTestId('team-filter')
        const options = teamFilter.querySelectorAll('option')
        expect(options.length).toBe(1) // Only "All Teams" option
      })
    })
  })

  describe('Employee Filtering (filteredEmployees)', () => {
    test('returns all employees when no search term and no team selected', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane Smith', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
    })

    test('filters by name (case-insensitive)', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane Smith', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      const searchInput = screen.getByPlaceholderText(
        'Search by name, designation, or team...'
      ) as HTMLInputElement

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      await userEvent.type(searchInput, 'john')
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
      })
    })

    test('filters by designation (case-insensitive)', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane Smith', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      const searchInput = screen.getByPlaceholderText(
        'Search by name, designation, or team...'
      ) as HTMLInputElement

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      await userEvent.type(searchInput, 'cto')
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
    })

    test('filters by team (case-insensitive)', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane Smith', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      const searchInput = screen.getByPlaceholderText(
        'Search by name, designation, or team...'
      ) as HTMLInputElement

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      await userEvent.type(searchInput, 'technology')
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
    })

    test('filters by selected team when team is selected', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane Smith', 'CTO', 'Technology', '1'),
        createEmployee('3', 'Bob Wilson', 'CFO', 'Finance', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      const teamFilter = screen.getByTestId('team-filter') as HTMLSelectElement

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      await userEvent.selectOptions(teamFilter, 'Technology')
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument()
      })
    })

    test('combines search term and team filter correctly', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane Smith', 'CTO', 'Technology', '1'),
        createEmployee('3', 'John Wilson', 'VP', 'Technology', '2'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      const searchInput = screen.getByPlaceholderText(
        'Search by name, designation, or team...'
      ) as HTMLInputElement
      const teamFilter = screen.getByTestId('team-filter') as HTMLSelectElement

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      await userEvent.selectOptions(teamFilter, 'Technology')
      await userEvent.type(searchInput, 'john')
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
        expect(screen.getByText('John Wilson')).toBeInTheDocument()
      })
    })

    test('returns empty array when no employees match filters', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      const searchInput = screen.getByPlaceholderText(
        'Search by name, designation, or team...'
      ) as HTMLInputElement

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      await userEvent.type(searchInput, 'nonexistent')
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
      })
    })
  })

  describe('Layout Calculation Effect', () => {
    test('calls calculateOrgChartLayout when filteredEmployees changes', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = createMockLayout(mockEmployees)
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        expect(mockCalculateLayout).toHaveBeenCalled()
      })
    })

    test('calls calculateOrgChartLayout with correct parameters', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane Smith', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = createMockLayout(mockEmployees)
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        expect(mockCalculateLayout).toHaveBeenCalledWith(
          mockEmployees,
          expect.arrayContaining(mockEmployees)
        )
      })
    })

    test('does not call layout calculation when filteredEmployees is empty', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { employees: [] },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        // Should not call layout calculation for empty employees
        expect(mockCalculateLayout).not.toHaveBeenCalled()
      })
    })
  })

  describe('Layout Dimensions Calculation (layoutDimensions)', () => {
    test('returns null when layout is null', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { employees: [] },
      } as unknown)
      mockCalculateLayout.mockResolvedValue(null)

      render(<OrgTree />)
      await waitFor(() => {
        const chartCanvas = document.querySelector('.chart-canvas')
        expect(chartCanvas).toBeInTheDocument()
      })
    })

    test('uses layout.width if available', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = {
        id: 'root',
        width: 1500,
        height: 1000,
        children: [{ id: '1', x: 100, y: 50, width: 220, height: 80 }],
        edges: [],
      }
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        const chartCanvas = document.querySelector('.chart-canvas')
        const style = chartCanvas?.getAttribute('style') || ''
        expect(style).toContain('width: 1500px')
      })
    })

    test('handles nodes with undefined x/y coordinates', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = {
        id: 'root',
        children: [
          { id: '1', x: undefined, y: undefined, width: 220, height: 80 },
        ],
        edges: [],
      }
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        // Should handle undefined coordinates gracefully
        expect(screen.getByText('John')).toBeInTheDocument()
      })
    })
  })

  describe('Sidebar Rendering', () => {
    test('renders search input with correct value binding', async () => {
      render(<OrgTree />)
      const searchInput = screen.getByPlaceholderText(
        'Search by name, designation, or team...'
      ) as HTMLInputElement

      await userEvent.type(searchInput, 'test')
      expect(searchInput.value).toBe('test')
    })

    test('renders team filter Select component', () => {
      render(<OrgTree />)
      expect(screen.getByTestId('team-filter')).toBeInTheDocument()
    })

    test('renders employee list items when not loading', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane Smith', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
    })

    test('each employee list item shows name, designation, and team', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('CEO')).toBeInTheDocument()
        const teamSpans = screen.getAllByText('Executive');
        expect(
          teamSpans.some(
            (node) =>
              node.tagName === 'SPAN' &&
              node.classList.contains('employee-list-item-team')
          )
        ).toBe(true);
      })
    })
  })

  describe('Chart Container Rendering', () => {
    test('renders DndContext', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = createMockLayout(mockEmployees)
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        const chartContainer = document.querySelector('.chart-container')
        expect(chartContainer).toBeInTheDocument()
      })
    })

    test('sets chart-canvas dimensions from layoutDimensions', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = {
        id: 'root',
        width: 1200,
        height: 900,
        children: [{ id: '1', x: 100, y: 50, width: 220, height: 80 }],
        edges: [],
      }
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        const chartCanvas = document.querySelector('.chart-canvas')
        const style = chartCanvas?.getAttribute('style') || ''
        expect(style).toContain('width: 1200px')
        expect(style).toContain('height: 900px')
      })
    })

    test('does not set dimensions when layoutDimensions is null', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { employees: [] },
      } as unknown)
      mockCalculateLayout.mockResolvedValue(null)

      render(<OrgTree />)
      await waitFor(() => {
        const chartCanvas = document.querySelector('.chart-canvas')
        // Should not have explicit width/height when layout is null
        const style = chartCanvas?.getAttribute('style') || ''
        expect(style).not.toContain('width:')
        expect(style).not.toContain('height:')
      })
    })
  })

  describe('SVG Connection Lines Rendering', () => {
    test('renders SVG when layout and layoutDimensions exist', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = {
        id: 'root',
        width: 1000,
        height: 800,
        children: [
          { id: '1', x: 100, y: 50, width: 220, height: 80 },
          { id: '2', x: 400, y: 200, width: 220, height: 80 },
        ],
        edges: [
          { id: 'edge-1-2', sources: ['1'], targets: ['2'] },
        ],
      }
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        const svg = document.querySelector('.chart-canvas svg')
        expect(svg).toBeInTheDocument()
      })
    })

    test('renders connection lines for all edges in layout', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = {
        id: 'root',
        width: 1000,
        height: 800,
        children: [
          { id: '1', x: 100, y: 50, width: 220, height: 80 },
          { id: '2', x: 400, y: 200, width: 220, height: 80 },
        ],
        edges: [
          { id: 'edge-1-2', sources: ['1'], targets: ['2'] },
        ],
      }
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        const paths = document.querySelectorAll('.connection-line')
        expect(paths.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Employee Nodes Rendering', () => {
    test('renders EmployeeNode for each child in layout', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = createMockLayout(mockEmployees)
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        expect(screen.getByTestId('employee-node-1')).toBeInTheDocument()
        expect(screen.getByTestId('employee-node-2')).toBeInTheDocument()
      })
    })

    test('does not render node when employee not found', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = {
        id: 'root',
        children: [
          { id: 'nonexistent', x: 100, y: 50, width: 220, height: 80 },
        ],
        edges: [],
      }
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        expect(screen.queryByTestId('employee-node-nonexistent')).not.toBeInTheDocument()
      })
    })

    test('does not render node when x/y coordinates are undefined', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = {
        id: 'root',
        children: [
          { id: '1', x: undefined, y: undefined, width: 220, height: 80 },
        ],
        edges: [],
      }
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        // Node should not render when coordinates are undefined
        expect(screen.queryByTestId('employee-node-1')).not.toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases & Error Handling', () => {
    test('handles empty employees array', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { employees: [] },
      } as unknown)

      render(<OrgTree />)
      await waitFor(() => {
        const employeeList = document.querySelector('.employee-list')
        expect(employeeList?.children.length).toBe(0)
      })
    })

    test('handles layout with no children', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = {
        id: 'root',
        children: [],
        edges: [],
      }
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        expect(screen.getByText('John')).toBeInTheDocument()
      })
    })

    test('handles layout with no edges', async () => {
      const mockEmployees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = {
        id: 'root',
        children: [{ id: '1', x: 100, y: 50, width: 220, height: 80 }],
        edges: [],
      }
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        const johnDoeSpans = screen.getAllByText('John');
        expect(johnDoeSpans.length).toBe(2);
      })
    })
  })

  describe('Integration Scenarios', () => {
    test('complete flow: fetch → filter → layout → render', async () => {
      const mockEmployees = [
        createEmployee('1', 'John Doe', 'CEO', 'Executive', ''),
        createEmployee('2', 'Jane Smith', 'CTO', 'Technology', '1'),
      ]
      mockAxiosGet.mockResolvedValue({
        data: { employees: mockEmployees },
      } as unknown)
      const mockLayout = createMockLayout(mockEmployees)
      mockCalculateLayout.mockResolvedValue(mockLayout as elkUtils.ELKLayout)

      render(<OrgTree />)
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledWith('/api/employees')
        expect(mockCalculateLayout).toHaveBeenCalled()

        const johnDoeSpans = screen.getAllByText('John Doe');
        const janeSmithSpans = screen.getAllByText('Jane Smith');
        expect(johnDoeSpans.length).toBe(2);
        expect(janeSmithSpans.length).toBe(2);
      })
    })
  })
})
