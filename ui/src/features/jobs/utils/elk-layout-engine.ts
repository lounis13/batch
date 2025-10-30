import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge, Position } from '@xyflow/react';

export type LayoutDirection = 'DOWN' | 'RIGHT' | 'UP' | 'LEFT';

interface LayoutOptions {
  direction?: LayoutDirection;
  nodeSpacing?: number;
  layerSpacing?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  flowWidth?: number;
  flowHeight?: number;
  flowPadding?: { top: number; left: number; bottom: number; right: number };
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  direction: 'DOWN',
  nodeSpacing: 80,
  layerSpacing: 100,
  nodeWidth: 250,
  nodeHeight: 150,
  flowWidth: 600,
  flowHeight: 400,
  flowPadding: { top: 60, left: 40, bottom: 40, right: 40 },
};

/**
 * ELK Layout Engine
 *
 * Handles the computation of node positions using ELK (Eclipse Layout Kernel)
 * with support for hierarchical flow structures.
 */
export class ELKLayoutEngine {
  private elk = new ELK();
  private options: Required<LayoutOptions>;

  constructor(options: LayoutOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Compute layout for nodes and edges
   */
  async layout(nodes: Node[], edges: Edge[]): Promise<{ nodes: Node[]; edges: Edge[] }> {
    const elkGraph = this.buildELKGraph(nodes, edges);
    const layoutedGraph = await this.elk.layout(elkGraph);
    const layoutedNodes = this.applyLayout(nodes, layoutedGraph);

    return {
      nodes: layoutedNodes,
      edges, // Edges don't change, only nodes get positions
    };
  }

  /**
   * Build ELK graph structure from React Flow nodes and edges
   */
  private buildELKGraph(nodes: Node[], edges: Edge[]): any {
    const { direction, nodeSpacing, layerSpacing } = this.options;

    const graph: any = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': direction,
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.spacing.nodeNode': String(nodeSpacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSpacing),
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      },
      children: [],
      edges: [],
    };

    // Group nodes by parent
    const nodesByParent = this.groupNodesByParent(nodes);

    // Build hierarchy recursively
    graph.children = this.buildChildren('root', nodesByParent, nodes);

    // Add edges (only between nodes at the same level)
    graph.edges = this.buildEdges(edges, nodes);

    return graph;
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
   * Build ELK children for a parent node
   */
  private buildChildren(
    parentId: string,
    nodesByParent: Map<string, Node[]>,
    allNodes: Node[]
  ): any[] {
    const children = nodesByParent.get(parentId) || [];
    const { nodeWidth, nodeHeight, flowWidth, flowHeight, flowPadding, direction } = this.options;

    return children.map(node => {
      const isFlow = node.type === 'flow';
      const elkNode: any = {
        id: node.id,
        width: isFlow ? flowWidth : nodeWidth,
        height: isFlow ? flowHeight : nodeHeight,
        layoutOptions: {
          'elk.direction': direction,
        },
      };

      // If it's a flow, add children recursively
      if (isFlow) {
        elkNode.children = this.buildChildren(node.id, nodesByParent, allNodes);
        elkNode.layoutOptions['elk.padding'] =
          `[top=${flowPadding.top},left=${flowPadding.left},bottom=${flowPadding.bottom},right=${flowPadding.right}]`;
        elkNode.layoutOptions['elk.hierarchyHandling'] = 'INCLUDE_CHILDREN';
      }

      return elkNode;
    });
  }

  /**
   * Build ELK edges (only same-level edges for ELK layout)
   */
  private buildEdges(edges: Edge[], nodes: Node[]): any[] {
    const nodeParentMap = new Map<string, string>();
    nodes.forEach(node => {
      nodeParentMap.set(node.id, (node as any).parentNode || 'root');
    });

    const elkEdges: any[] = [];
    const addedEdges = new Set<string>();

    edges.forEach(edge => {
      const sourceParent = nodeParentMap.get(edge.source) || 'root';
      const targetParent = nodeParentMap.get(edge.target) || 'root';

      // Only add edges between nodes with the same parent
      if (sourceParent === targetParent) {
        const edgeKey = `${edge.source}__${edge.target}`;
        if (!addedEdges.has(edgeKey)) {
          elkEdges.push({
            id: edgeKey,
            sources: [edge.source],
            targets: [edge.target],
          });
          addedEdges.add(edgeKey);
        }
      }
    });

    return elkEdges;
  }

  /**
   * Apply ELK layout results to React Flow nodes
   */
  private applyLayout(nodes: Node[], elkGraph: any): Node[] {
    const layoutedNodes: Node[] = [];
    const { direction } = this.options;
    const isHorizontal = direction === 'RIGHT' || direction === 'LEFT';

    // Collect all ELK nodes recursively
    const elkNodeMap = new Map<string, any>();
    const collectElkNodes = (elkNode: any, offsetX = 0, offsetY = 0) => {
      elkNodeMap.set(elkNode.id, {
        ...elkNode,
        absoluteX: (elkNode.x || 0) + offsetX,
        absoluteY: (elkNode.y || 0) + offsetY,
      });

      if (elkNode.children) {
        elkNode.children.forEach((child: any) => {
          collectElkNodes(child, (elkNode.x || 0) + offsetX, (elkNode.y || 0) + offsetY);
        });
      }
    };

    elkGraph.children?.forEach((child: any) => collectElkNodes(child));

    // Apply positions to React Flow nodes
    nodes.forEach(node => {
      const elkNode = elkNodeMap.get(node.id);
      if (!elkNode) {
        layoutedNodes.push(node);
        return;
      }

      const isFlow = node.type === 'flow';

      layoutedNodes.push({
        ...node,
        position: {
          x: elkNode.absoluteX,
          y: elkNode.absoluteY,
        },
        data: {
          ...node.data,
          isHorizontal,
        },
        style: isFlow ? {
          width: elkNode.width,
          height: elkNode.height,
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          border: '2px dashed rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          padding: '20px',
        } : {
          width: elkNode.width,
          height: elkNode.height,
        },
        sourcePosition: (isHorizontal ? 'right' : 'bottom') as Position,
        targetPosition: (isHorizontal ? 'left' : 'top') as Position,
      });
    });

    return layoutedNodes;
  }
}
