import { expect, test, describe } from 'vitest'
import { calculateOrgChartLayout } from '../utils/elkUtils'
import { Employee } from '../../services/types'

describe('calculateOrgChartLayout', () => {
  // Helper function to create mock employees
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

  describe('Empty/Null Input Cases', () => {
    test('should return null when filteredEmployees is empty', async () => {
      const employees = [
        createEmployee('1', 'John', 'CEO', 'Executive', ''),
      ]
      const result = await calculateOrgChartLayout(employees, [])
      expect(result).toBeNull()
    })

    test('should return null when both arrays are empty', async () => {
      const result = await calculateOrgChartLayout([], [])
      expect(result).toBeNull()
    })

  });

  describe('Single Employee Cases', () => {
    test('should return layout for single employee with no manager', async () => {
      const employee = createEmployee('1', 'John', 'CEO', 'Executive', '')
      const result = await calculateOrgChartLayout([employee], [employee])

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(1)
      expect(result?.children?.[0].id).toBe('1')
      expect(result?.children?.[0].width).toBe(220)
      expect(result?.children?.[0].height).toBe(80)
      expect(result?.edges).toHaveLength(0)
    })

    test('should include manager when single employee has manager not in filtered', async () => {
      const manager = createEmployee('1', 'Manager', 'Manager', 'Team', '')
      const employee = createEmployee('2', 'John', 'Developer', 'Team', '1')
      const result = await calculateOrgChartLayout(
        [manager, employee],
        [employee]
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(2)
      const nodeIds = result?.children?.map(n => n.id) || []
      expect(nodeIds).toContain('1')
      expect(nodeIds).toContain('2')
      expect(result?.edges).toHaveLength(1)
      expect(result?.edges?.[0].sources).toContain('1')
      expect(result?.edges?.[0].targets).toContain('2')
    })
  })

  describe('Basic Hierarchy Cases', () => {
    test('should create correct layout for 2-level hierarchy', async () => {
      const manager = createEmployee('1', 'Manager', 'Manager', 'Team', '')
      const employee = createEmployee('2', 'John', 'Developer', 'Team', '1')
      const result = await calculateOrgChartLayout(
        [manager, employee],
        [manager, employee]
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(2)
      expect(result?.edges).toHaveLength(1)
      expect(result?.edges?.[0].sources).toContain('1')
      expect(result?.edges?.[0].targets).toContain('2')
    })

    test('should create correct layout for 3-level hierarchy', async () => {
      const ceo = createEmployee('1', 'CEO', 'CEO', 'Executive', '')
      const manager = createEmployee('2', 'Manager', 'Manager', 'Team', '1')
      const employee = createEmployee('3', 'John', 'Developer', 'Team', '2')
      const result = await calculateOrgChartLayout(
        [ceo, manager, employee],
        [ceo, manager, employee]
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(3)
      expect(result?.edges).toHaveLength(2)
      const edgeSources = result?.edges?.map(e => e.sources[0]) || []
      const edgeTargets = result?.edges?.map(e => e.targets[0]) || []
      expect(edgeSources).toContain('1')
      expect(edgeSources).toContain('2')
      expect(edgeTargets).toContain('2')
      expect(edgeTargets).toContain('3')
    })

    test('should create multiple edges from same manager', async () => {
      const manager = createEmployee('1', 'Manager', 'Manager', 'Team', '')
      const emp1 = createEmployee('2', 'John', 'Developer', 'Team', '1')
      const emp2 = createEmployee('3', 'Jane', 'Developer', 'Team', '1')
      const result = await calculateOrgChartLayout(
        [manager, emp1, emp2],
        [manager, emp1, emp2]
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(3)
      expect(result?.edges).toHaveLength(2)
      const edgesFromManager = result?.edges?.filter(
        e => e.sources[0] === '1'
      ) || []
      expect(edgesFromManager).toHaveLength(2)
    })
  })

  describe('Manager Chain Inclusion', () => {
    test('should include manager when filtered employee has manager not in filtered list', async () => {
      const manager = createEmployee('1', 'Manager', 'Manager', 'Team', '')
      const employee = createEmployee('2', 'John', 'Developer', 'Team', '1')
      const result = await calculateOrgChartLayout(
        [manager, employee],
        [employee] // Only employee in filtered, not manager
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(2)
      const nodeIds = result?.children?.map(n => n.id) || []
      expect(nodeIds).toContain('1')
      expect(nodeIds).toContain('2')
    })

    test('should include multi-level manager chain', async () => {
      const ceo = createEmployee('1', 'CEO', 'CEO', 'Executive', '')
      const manager = createEmployee('2', 'Manager', 'Manager', 'Team', '1')
      const employee = createEmployee('3', 'John', 'Developer', 'Team', '2')
      const result = await calculateOrgChartLayout(
        [ceo, manager, employee],
        [employee] // Only employee in filtered
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(3)
      const nodeIds = result?.children?.map(n => n.id) || []
      expect(nodeIds).toContain('1')
      expect(nodeIds).toContain('2')
      expect(nodeIds).toContain('3')
    })

    test('should not duplicate nodes when multiple filtered employees share manager chain', async () => {
      const ceo = createEmployee('1', 'CEO', 'CEO', 'Executive', '')
      const manager = createEmployee('2', 'Manager', 'Manager', 'Team', '1')
      const emp1 = createEmployee('3', 'John', 'Developer', 'Team', '2')
      const emp2 = createEmployee('4', 'Jane', 'Developer', 'Team', '2')
      const result = await calculateOrgChartLayout(
        [ceo, manager, emp1, emp2],
        [emp1, emp2] // Both employees share same manager chain
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(4)
      const nodeIds = result?.children?.map(n => n.id) || []
      // Should have unique nodes only
      expect(new Set(nodeIds).size).toBe(4)
    })
  })

  describe('Edge Cases', () => {
    test('should handle multiple root nodes (employees without managers)', async () => {
      const root1 = createEmployee('1', 'CEO1', 'CEO', 'Executive', '')
      const root2 = createEmployee('2', 'CEO2', 'CEO', 'Executive', '')
      const result = await calculateOrgChartLayout(
        [root1, root2],
        [root1, root2]
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(2)
      expect(result?.edges).toHaveLength(0)
    })

    test('should handle employee with empty managerId', async () => {
      const employee = createEmployee('1', 'John', 'CEO', 'Executive', '')
      const result = await calculateOrgChartLayout([employee], [employee])

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(1)
      expect(result?.edges).toHaveLength(0)
    })
  })

  describe('No Manager Relationships', () => {
    test('should return layout with nodes but no edges when no employees have managers', async () => {
      const emp1 = createEmployee('1', 'John', 'CEO', 'Executive', '')
      const emp2 = createEmployee('2', 'Jane', 'CTO', 'Executive', '')
      const result = await calculateOrgChartLayout(
        [emp1, emp2],
        [emp1, emp2]
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(2)
      expect(result?.edges).toHaveLength(0)
    })

    test('should handle filtered employees with no managers', async () => {
      const emp1 = createEmployee('1', 'John', 'CEO', 'Executive', '')
      const emp2 = createEmployee('2', 'Jane', 'CTO', 'Executive', '')
      const result = await calculateOrgChartLayout(
        [emp1, emp2],
        [emp1] // Only one filtered
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(1)
      expect(result?.edges).toHaveLength(0)
    })
  })

  describe('Node and Edge Generation', () => {
    test('should create nodes with correct dimensions', async () => {
      const employee = createEmployee('1', 'John', 'CEO', 'Executive', '')
      const result = await calculateOrgChartLayout([employee], [employee])

      expect(result?.children?.[0].width).toBe(220)
      expect(result?.children?.[0].height).toBe(80)
    })

    test('should create nodes with unique IDs matching employee IDs', async () => {
      const emp1 = createEmployee('1', 'John', 'CEO', 'Executive', '')
      const emp2 = createEmployee('2', 'Jane', 'CTO', 'Executive', '')
      const result = await calculateOrgChartLayout(
        [emp1, emp2],
        [emp1, emp2]
      )

      const nodeIds = result?.children?.map(n => n.id) || []
      expect(nodeIds).toContain('1')
      expect(nodeIds).toContain('2')
      expect(new Set(nodeIds).size).toBe(2)
    })

    test('should create edges with correct ID pattern', async () => {
      const manager = createEmployee('1', 'Manager', 'Manager', 'Team', '')
      const employee = createEmployee('2', 'John', 'Developer', 'Team', '1')
      const result = await calculateOrgChartLayout(
        [manager, employee],
        [manager, employee]
      )

      expect(result?.edges?.[0].id).toBe('edge-1-2')
    })

    test('should map edge sources and targets correctly', async () => {
      const manager = createEmployee('1', 'Manager', 'Manager', 'Team', '')
      const employee = createEmployee('2', 'John', 'Developer', 'Team', '1')
      const result = await calculateOrgChartLayout(
        [manager, employee],
        [manager, employee]
      )

      expect(result?.edges?.[0].sources).toContain('1')
      expect(result?.edges?.[0].targets).toContain('2')
    })
  })

  describe('Complex Scenarios', () => {
    test('should handle deep hierarchy (5+ levels)', async () => {
      const level1 = createEmployee('1', 'CEO', 'CEO', 'Executive', '')
      const level2 = createEmployee('2', 'VP', 'VP', 'Executive', '1')
      const level3 = createEmployee('3', 'Director', 'Director', 'Team', '2')
      const level4 = createEmployee('4', 'Manager', 'Manager', 'Team', '3')
      const level5 = createEmployee('5', 'Employee', 'Employee', 'Team', '4')
      const result = await calculateOrgChartLayout(
        [level1, level2, level3, level4, level5],
        [level1, level2, level3, level4, level5]
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(5)
      expect(result?.edges).toHaveLength(4)
    })

    test('should handle wide hierarchy (many siblings)', async () => {
      const manager = createEmployee('1', 'Manager', 'Manager', 'Team', '')
      const employees = Array.from({ length: 10 }, (_, i) =>
        createEmployee(
          `${i + 2}`,
          `Employee${i + 2}`,
          'Developer',
          'Team',
          '1'
        )
      )
      const result = await calculateOrgChartLayout(
        [manager, ...employees],
        [manager, ...employees]
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(11)
      expect(result?.edges).toHaveLength(10)
    })

    test('should handle mixed filtered employees at different levels', async () => {
      const ceo = createEmployee('1', 'CEO', 'CEO', 'Executive', '')
      const manager = createEmployee('2', 'Manager', 'Manager', 'Team', '1')
      const emp1 = createEmployee('3', 'John', 'Developer', 'Team', '2')
      const emp2 = createEmployee('4', 'Jane', 'Developer', 'Team', '2')
      const result = await calculateOrgChartLayout(
        [ceo, manager, emp1, emp2],
        [ceo, emp2] // CEO and emp2 filtered, manager and emp1 not
      )

      expect(result).not.toBeNull()
      // Should include manager because emp2 needs it
      expect(result?.children?.length).toBeGreaterThanOrEqual(3)
      const nodeIds = result?.children?.map(n => n.id) || []
      expect(nodeIds).toContain('1')
      expect(nodeIds).toContain('2')
      expect(nodeIds).toContain('4')
    })

    test('should handle disconnected sub-trees', async () => {
      const root1 = createEmployee('1', 'CEO1', 'CEO', 'Executive', '')
      const emp1 = createEmployee('2', 'John', 'Developer', 'Team', '1')
      const root2 = createEmployee('3', 'CEO2', 'CEO', 'Executive', '')
      const emp2 = createEmployee('4', 'Jane', 'Developer', 'Team', '3')
      const result = await calculateOrgChartLayout(
        [root1, emp1, root2, emp2],
        [root1, emp1, root2, emp2]
      )

      expect(result).not.toBeNull()
      expect(result?.children).toHaveLength(4)
      expect(result?.edges).toHaveLength(2)
    })
  })

  describe('Return Value Validation', () => {
    test('should return layout with correct structure', async () => {
      const employee = createEmployee('1', 'John', 'CEO', 'Executive', '')
      const result = await calculateOrgChartLayout([employee], [employee])

      expect(result).not.toBeNull()
      expect(result?.id).toBe('root')
      expect(result?.children).toBeDefined()
      expect(Array.isArray(result?.children)).toBe(true)
      expect(result?.edges).toBeDefined()
      expect(Array.isArray(result?.edges)).toBe(true)
    })

    test('should return nodes with x and y coordinates after layout', async () => {
      const employee = createEmployee('1', 'John', 'CEO', 'Executive', '')
      const result = await calculateOrgChartLayout([employee], [employee])

      expect(result?.children?.[0].x).toBeDefined()
      expect(result?.children?.[0].y).toBeDefined()
      expect(typeof result?.children?.[0].x).toBe('number')
      expect(typeof result?.children?.[0].y).toBe('number')
    })

    test('should include all filtered employees in layout', async () => {
      const emp1 = createEmployee('1', 'John', 'CEO', 'Executive', '')
      const emp2 = createEmployee('2', 'Jane', 'CTO', 'Executive', '')
      const result = await calculateOrgChartLayout(
        [emp1, emp2],
        [emp1, emp2]
      )

      const nodeIds = result?.children?.map(n => n.id) || []
      expect(nodeIds).toContain('1')
      expect(nodeIds).toContain('2')
    })

    test('should include all required managers in layout', async () => {
      const manager = createEmployee('1', 'Manager', 'Manager', 'Team', '')
      const employee = createEmployee('2', 'John', 'Developer', 'Team', '1')
      const result = await calculateOrgChartLayout(
        [manager, employee],
        [employee] // Only employee filtered
      )

      const nodeIds = result?.children?.map(n => n.id) || []
      expect(nodeIds).toContain('1') // Manager should be included
      expect(nodeIds).toContain('2') // Employee should be included
    })
  })
})
