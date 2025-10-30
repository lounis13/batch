import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';

export type LayoutDirection = 'DOWN' | 'RIGHT';

const elk = new ELK();

interface ElkLayoutOptions {
  direction?: LayoutDirection;
  nodeSpacing?: number;
  layerSpacing?: number;
  groupPadding?: {
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  };
  nodeWidth?: number;
  nodeHeight?: number;
  groupWidth?: number;
  groupHeight?: number;
}

/**
 * Layout algorithm using ELK.js with support for groups (subflows)
 *
 * This function takes React Flow nodes and edges and computes their positions
 * using the Eclipse Layout Kernel (ELK) with the layered algorithm.
 *
 * Features:
 * - Hierarchical layout for nested subflows
 * - Configurable direction (DOWN or RIGHT)
 * - Automatic group node sizing
 * - Maintains parent-child relationships
 */
export async function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: ElkLayoutOptions = {}
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const {
    direction = 'DOWN',
    nodeSpacing = 80,
    layerSpacing = 100,
    groupPadding = { top: 40, left: 20, bottom: 20, right: 20 },
    nodeWidth = 250,
    nodeHeight = 150,
    groupWidth = 400,
    groupHeight = 200,
  } = options;

  const isHorizontal = direction === 'RIGHT';

  // Build ELK graph with groups
  const graph: any = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': String(nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSpacing),
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: [] as any[],
    edges: [] as any[],
  };

  // Group nodes by parent
  const nodesByParent = new Map<string, Node[]>();
  nodes.forEach((node) => {
    const parentId = (node as any).parentNode || 'root';
    if (!nodesByParent.has(parentId)) {
      nodesByParent.set(parentId, []);
    }
    nodesByParent.get(parentId)!.push(node);
  });

  // Convert nodes to ELK format (recursive)
  const processNodes = (parentId: string, parentElkNode?: any) => {
    const children = nodesByParent.get(parentId) || [];

    children.forEach((node) => {
      const isFlow = node.type === 'flow';
      const elkNode: any = {
        id: node.id,
        width: isFlow ? groupWidth : nodeWidth,
        height: isFlow ? groupHeight : nodeHeight,
      };

      // If node is a flow (group), process its children recursively
      if (isFlow) {
        elkNode.children = [];
        elkNode.layoutOptions = {
          'elk.padding': `[top=${groupPadding.top},left=${groupPadding.left},bottom=${groupPadding.bottom},right=${groupPadding.right}]`,
        };
        processNodes(node.id, elkNode);
      }

      if (parentElkNode) {
        parentElkNode.children.push(elkNode);
      } else {
        graph.children.push(elkNode);
      }
    });
  };

  processNodes('root');

  // Build a set of all ELK node IDs (flatten the entire tree)
  const elkNodeIds = new Set<string>();
  const collectElkIds = (node: any) => {
    elkNodeIds.add(node.id);
    if (node.children) {
      node.children.forEach((child: any) => collectElkIds(child));
    }
  };
  graph.children.forEach((child: any) => collectElkIds(child));

  // Build parent map from React Flow nodes
  const nodeParentMap = new Map<string, string | undefined>();
  nodes.forEach(n => {
    nodeParentMap.set(n.id, (n as any).parentNode);
  });

  // Convert edges to ELK format
  // Only include edges where BOTH nodes exist in the ELK graph
  const elkEdges = new Map<string, any>();
  edges.forEach((edge) => {
    const sourceInElk = elkNodeIds.has(edge.source);
    const targetInElk = elkNodeIds.has(edge.target);

    if (sourceInElk && targetInElk) {
      const sourceParent = nodeParentMap.get(edge.source) || 'root';
      const targetParent = nodeParentMap.get(edge.target) || 'root';

      // Only add edge if both nodes are at the same hierarchy level (same parent)
      if (sourceParent === targetParent) {
        const id = `${edge.source}__to__${edge.target}`;
        if (!elkEdges.has(id)) {
          elkEdges.set(id, {
            id,
            sources: [edge.source],
            targets: [edge.target],
          });
        }
      }
    }
  });

  graph.edges = Array.from(elkEdges.values());

  // Run ELK layout
  const layoutedGraph = await elk.layout(graph);

  // Apply positions to nodes (recursive)
  const layoutedNodes: Node[] = [];

  const applyPositions = (elkNode: any, parentX = 0, parentY = 0) => {
    const node = nodes.find((n) => n.id === elkNode.id);
    if (!node) return;

    const isFlow = node.type === 'flow';

    layoutedNodes.push({
      ...node,
      position: {
        x: (elkNode.x || 0) + parentX,
        y: (elkNode.y || 0) + parentY,
      },
      data: {
        ...node.data,
        isHorizontal,
      },
      style: isFlow ? {
        width: elkNode.width,
        height: elkNode.height,
        backgroundColor: 'rgba(240, 240, 255, 0.3)',
        border: '2px dashed #888',
        borderRadius: '8px',
        padding: '20px',
      } : undefined,
    });

    // Process children recursively
    if (elkNode.children) {
      elkNode.children.forEach((child: any) => {
        applyPositions(child, (elkNode.x || 0) + parentX, (elkNode.y || 0) + parentY);
      });
    }
  };

  layoutedGraph.children?.forEach((child: any) => {
    applyPositions(child);
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Re-layout existing nodes and edges with new direction
 */
export async function relayout(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  return getLayoutedElements(nodes, edges, { direction });
}
