import dagre from 'dagre';
import type { Node, Edge, Position } from '@xyflow/react';

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

interface LayoutOptions {
  direction?: LayoutDirection;
  nodeSpacing?: number;
  rankSpacing?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  flowWidth?: number;
  flowHeight?: number;
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  direction: 'TB',
  nodeSpacing: 80,
  rankSpacing: 100,
  nodeWidth: 250,
  nodeHeight: 150,
  flowWidth: 600,
  flowHeight: 400,
};

/**
 * Dagre Layout Engine
 *
 * Handles the computation of node positions using Dagre
 * with support for hierarchical flow structures.
 *
 * Note: Dagre doesn't support nested graphs natively,
 * so we flatten the hierarchy for layout and restore it after.
 */
export class DagreLayoutEngine {
  private options: Required<LayoutOptions>;

  constructor(options: LayoutOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Compute layout for nodes and edges
   */
  async layout(nodes: Node[], edges: Edge[]): Promise<{ nodes: Node[]; edges: Edge[] }> {
    try {
      // Validation
      if (!nodes || nodes.length === 0) {
        return { nodes: [], edges: [] };
      }

      const { direction, nodeSpacing, rankSpacing, nodeWidth, nodeHeight, flowWidth, flowHeight } = this.options;

      // Group nodes by parent for layout within groups
      const nodesByParent = this.groupNodesByParent(nodes);

      // Layout each group separately
      const layoutedNodePositions = new Map<string, { x: number; y: number }>();

      // First, layout root-level nodes
      const rootNodes = nodesByParent.get('root') || [];
      if (rootNodes.length > 0) {
        await this.layoutGroup('root', rootNodes, edges, layoutedNodePositions);
      }

      // Then, layout each flow's children
      for (const [parentId, childNodes] of nodesByParent.entries()) {
        if (parentId !== 'root' && childNodes.length > 0) {
          const parentEdges = edges.filter(e =>
            childNodes.some(n => n.id === e.source) || childNodes.some(n => n.id === e.target)
          );
          await this.layoutGroup(parentId, childNodes, parentEdges, layoutedNodePositions);
        }
      }

      // Apply positions to nodes
      const isHorizontal = direction === 'LR' || direction === 'RL';
      const layoutedNodes = nodes.map(node => {
        const position = layoutedNodePositions.get(node.id) || { x: 0, y: 0 };
        const isFlow = node.type === 'flow';
        const width = isFlow ? flowWidth : nodeWidth;
        const height = isFlow ? flowHeight : nodeHeight;

        return {
          ...node,
          position,
          data: {
            ...node.data,
            isHorizontal,
          },
          style: isFlow ? {
            width,
            height,
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            border: '2px dashed rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '20px',
          } : {
            width,
            height,
          },
          sourcePosition: (isHorizontal ? 'right' : 'bottom') as Position,
          targetPosition: (isHorizontal ? 'left' : 'top') as Position,
        };
      });

      return {
        nodes: layoutedNodes,
        edges,
      };
    } catch (error) {
      console.error('Dagre layout error:', error);
      throw new Error(`Dagre layout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Group nodes by their parent
   */
  private groupNodesByParent(nodes: Node[]): Map<string, Node[]> {
    const groups = new Map<string, Node[]>();

    nodes.forEach(node => {
      const parentId = (node as any).parentNode || 'root';
      if (!groups.has(parentId)) {
        groups.set(parentId, []);
      }
      groups.get(parentId)!.push(node);
    });

    return groups;
  }

  /**
   * Layout a group of nodes (either root or within a flow)
   */
  private async layoutGroup(
    groupId: string,
    nodes: Node[],
    edges: Edge[],
    positions: Map<string, { x: number; y: number }>
  ): Promise<void> {
    if (nodes.length === 0) return;

    const { direction, nodeSpacing, rankSpacing, nodeWidth, nodeHeight, flowWidth, flowHeight } = this.options;

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: direction,
      nodesep: nodeSpacing,
      ranksep: rankSpacing,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to graph
    nodes.forEach(node => {
      const isFlow = node.type === 'flow';
      g.setNode(node.id, {
        width: isFlow ? flowWidth : nodeWidth,
        height: isFlow ? flowHeight : nodeHeight,
      });
    });

    // Add edges (only within this group)
    const nodeIds = new Set(nodes.map(n => n.id));
    edges.forEach(edge => {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    });

    // Run layout
    try {
      dagre.layout(g);
    } catch (error) {
      console.error(`Dagre layout failed for group ${groupId}:`, error);
      // Fallback: position nodes in a simple grid
      nodes.forEach((node, index) => {
        positions.set(node.id, {
          x: (index % 3) * 300,
          y: Math.floor(index / 3) * 200,
        });
      });
      return;
    }

    // Calculate group offset if this is a child group
    let offsetX = 0;
    let offsetY = 0;

    if (groupId !== 'root') {
      const parentPosition = positions.get(groupId);
      if (parentPosition) {
        offsetX = parentPosition.x + 40; // Padding inside flow
        offsetY = parentPosition.y + 60; // Header space
      }
    }

    // Store positions
    nodes.forEach(node => {
      const dagreNode = g.node(node.id);
      if (dagreNode && dagreNode.x !== undefined && dagreNode.y !== undefined) {
        positions.set(node.id, {
          x: dagreNode.x - (dagreNode.width / 2) + offsetX,
          y: dagreNode.y - (dagreNode.height / 2) + offsetY,
        });
      } else {
        // Fallback position
        console.warn(`No position computed for node ${node.id}`);
        positions.set(node.id, { x: offsetX, y: offsetY });
      }
    });
  }
}
