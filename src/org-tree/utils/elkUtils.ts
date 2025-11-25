import ELK from 'elkjs/lib/elk.bundled.js';
import { Employee } from '../../services/types';

export interface ELKNode {
    id: string;
    x?: number;
    y?: number;
    width: number;
    height: number;
}

export interface ELKEdge {
    id: string;
    sources: string[];
    targets: string[];
}

export interface ELKLayout {
    id: string;
    children?: ELKNode[];
    edges?: ELKEdge[];
    width?: number;
    height?: number;
}

interface ELKLayoutOptions {
    algorithm?: string;
    direction?: string;
    spacing?: string;
    layerSpacing?: string;
}

const DEFAULT_LAYOUT_OPTIONS: ELKLayoutOptions = {
    algorithm: 'layered',
    direction: 'DOWN',
    spacing: '50',
    layerSpacing: '80',
};

export async function calculateOrgChartLayout(
    employees: Employee[],
    filteredEmployees: Employee[],
    options: Partial<ELKLayoutOptions> = {}
): Promise<ELKLayout | null> {
    if (filteredEmployees.length === 0) {
        return null;
    }

    const elk = new ELK();
    const layoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };

    const filteredIds = new Set(filteredEmployees.map(e => e.id));

    const nodesToShow = new Set(filteredIds);
    filteredEmployees.forEach(emp => {
        let current: Employee | null = emp;
        while (current.managerId) {
            nodesToShow.add(current.managerId);
            current = employees.find(e => e.id === current?.managerId) || null;
            if (!current) break;
        }
    });

    const displayEmployees = employees.filter(e => nodesToShow.has(e.id));

    const nodes = displayEmployees.map(emp => ({
        id: emp.id,
        width: 220,
        height: 80,
    }));

    const edges = displayEmployees
        .filter(emp => emp.managerId && nodesToShow.has(emp.managerId) && nodesToShow.has(emp.id))
        .map(emp => ({
            id: `edge-${emp.managerId}-${emp.id}`,
            sources: [emp.managerId],
            targets: [emp.id],
        }));

    try {
        const graph = await elk.layout({
            id: 'root',
            layoutOptions: {
                'elk.algorithm': layoutOptions.algorithm as string,
                'elk.direction': layoutOptions.direction as string,
                'elk.spacing.nodeNode': layoutOptions.spacing as string,
                'elk.layered.spacing.nodeNodeBetweenLayers': layoutOptions.layerSpacing as string,
            },
            children: nodes,
            edges: edges,
        });

        return graph as ELKLayout;
    } catch (error) {
        console.error('Layout calculation failed:', error);
        return null;
    }
}

