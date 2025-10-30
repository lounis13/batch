import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { TaskNode, SubFlowNode } from './flow-nodes';
import type { JobDetailFlat, FlatTask, TaskDependency } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDown, ArrowRight } from 'lucide-react';

const nodeTypes = {
  task: TaskNode,
  group: SubFlowNode,
};

type LayoutDirection = 'DOWN' | 'RIGHT';

const elk = new ELK();

/**
 * Layout algorithm using ELK.js with group support
 */
async function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = 'DOWN'
) {
  const isHorizontal = direction === 'RIGHT';

  // Build ELK graph with groups
  const graph: any = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
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

  // Convert nodes to ELK format
  const elkNodes = new Map<string, any>();

  const processNodes = (parentId: string, parentElkNode?: any) => {
    const children = nodesByParent.get(parentId) || [];

    children.forEach((node) => {
      const elkNode: any = {
        id: node.id,
        width: node.type === 'group' ? 400 : 250,
        height: node.type === 'group' ? 200 : 150,
      };

      // If node is a group, process its children recursively
      if (node.type === 'group') {
        elkNode.children = [];
        elkNode.layoutOptions = {
          'elk.padding': '[top=40,left=20,bottom=20,right=20]',
        };
        processNodes(node.id, elkNode);
      }

      if (parentElkNode) {
        parentElkNode.children.push(elkNode);
      } else {
        graph.children.push(elkNode);
      }

      elkNodes.set(node.id, elkNode);
    });
  };

  processNodes('root');

  // Convert edges to ELK format
  edges.forEach((edge) => {
    graph.edges.push({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    });
  });

  // Run ELK layout
  const layoutedGraph = await elk.layout(graph);

  // Apply positions to nodes
  const layoutedNodes: Node[] = [];

  const applyPositions = (elkNode: any, parentX = 0, parentY = 0) => {
    const node = nodes.find((n) => n.id === elkNode.id);
    if (!node) return;

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
      style: node.type === 'group' ? {
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
 * Group tasks by their parent (subflow)
 */
function groupTasksByParent(tasks: FlatTask[]): Map<string, FlatTask[]> {
  const groups = new Map<string, FlatTask[]>();

  tasks.forEach((task) => {
    const parts = task.task_id.split('.');
    const parent = parts.length > 1 ? parts.slice(0, -1).join('.') : 'root';

    if (!groups.has(parent)) {
      groups.set(parent, []);
    }
    groups.get(parent)!.push(task);
  });

  return groups;
}

/**
 * Convert job data to ReactFlow nodes and edges with groups
 */
function convertToFlowElements(job: JobDetailFlat): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const groups = groupTasksByParent(job.tasks);
  const processedGroups = new Set<string>();
  const allNodeIds = new Set<string>();

  // Create group nodes (subflows)
  groups.forEach((tasks, groupId) => {
    if (groupId !== 'root' && tasks.length > 0) {
      const subflowTask = job.tasks.find(t => t.task_id === groupId);

      if (subflowTask) {
        // Determine parent for this group
        const parts = groupId.split('.');
        const parentId = parts.length > 1 ? parts.slice(0, -1).join('.') : undefined;

        nodes.push({
          id: groupId,
          type: 'group',
          position: { x: 0, y: 0 },
          data: {
            id: groupId,
            label: subflowTask.name || groupId,
            state: subflowTask.state,
            taskCount: tasks.length,
            description: subflowTask.description,
          },
          ...(parentId && parentId !== 'root' ? { parentNode: parentId } : {}),
        });
        processedGroups.add(groupId);
        allNodeIds.add(groupId);
      }
    }
  });

  // Create task nodes
  job.tasks.forEach((task) => {
    // Skip if this task is a group itself
    if (processedGroups.has(task.task_id)) {
      return;
    }

    // Determine parent
    const parts = task.task_id.split('.');
    const parentId = parts.length > 1 ? parts.slice(0, -1).join('.') : undefined;

    nodes.push({
      id: task.task_id,
      type: 'task',
      position: { x: 0, y: 0 },
      data: task,
      ...(parentId && parentId !== 'root' ? { parentNode: parentId } : {}),
      extent: parentId ? 'parent' as const : undefined,
    });
    allNodeIds.add(task.task_id);
  });

  // Create edges from dependencies - only if both source and target exist
  job.dependencies.forEach((dep: TaskDependency, index) => {
    // Only create edge if both source and target nodes exist
    if (allNodeIds.has(dep.source) && allNodeIds.has(dep.target)) {
      edges.push({
        id: `e-${dep.source}-${dep.target}-${index}`,
        source: dep.source,
        target: dep.target,
        animated: dep.source_output !== null,
        style: { strokeWidth: 2 },
      });
    }
  });

  return { nodes, edges };
}

interface FlowVisualizationProps {
  job: JobDetailFlat;
}

/**
 * Flow Visualization Component with ELK.js and Groups
 * Displays workflow execution as an interactive graph with subflows
 */
export function FlowVisualization({ job }: FlowVisualizationProps) {
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('DOWN');
  const [isLayouting, setIsLayouting] = useState(false);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => convertToFlowElements(job),
    [job]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Apply ELK layout
  useEffect(() => {
    const applyLayout = async () => {
      setIsLayouting(true);
      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
        initialNodes,
        initialEdges,
        layoutDirection
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setIsLayouting(false);
    };

    applyLayout();
  }, [initialNodes, initialEdges, layoutDirection, setNodes, setEdges]);

  const handleLayoutChange = useCallback((value: LayoutDirection) => {
    setLayoutDirection(value);
  }, []);

  return (
    <Card className="h-[calc(100vh-200px)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle>Workflow Execution</CardTitle>
        <div className="flex gap-2">
          <Select value={layoutDirection} onValueChange={handleLayoutChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select layout" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DOWN">
                <div className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4" />
                  Top to Bottom
                </div>
              </SelectItem>
              <SelectItem value="RIGHT">
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Left to Right
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[calc(100vh-280px)]">
          {isLayouting ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Computing layout...</div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.1}
              maxZoom={2}
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  const state = (node.data as any)?.state?.toLowerCase();
                  const colors: Record<string, string> = {
                    completed: '#22c55e',
                    successful: '#22c55e',
                    running: '#eab308',
                    failed: '#ef4444',
                    pending: '#94a3b8',
                    scheduled: '#3b82f6',
                  };
                  return colors[state] || '#94a3b8';
                }}
              />
            </ReactFlow>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
