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
import { TaskNode, SubFlowNode } from './flow-nodes';
import type { JobDetailFlat, FlatTask, TaskDependency } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { getLayoutedElements, type LayoutDirection } from '../utils/elk-layout';

const nodeTypes = {
  task: TaskNode,
  flow: SubFlowNode,
};

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

  // Index all tasks by ID and type
  const taskById = new Map(job.tasks.map(t => [t.task_id, t]));

  // Identify which task_ids are groups
  // A task is a group if:
  // 1. task_type === 'flow' OR
  // 2. It has children (detected by groupTasksByParent)
  const groups = groupTasksByParent(job.tasks);
  const groupIds = new Set<string>();

  // Method 1: Tasks with task_type === 'flow' are groups
  job.tasks.forEach(task => {
    if (task.task_type === 'flow') {
      groupIds.add(task.task_id);
    }
  });

  // Method 2: Tasks that have children are groups
  groups.forEach((children, groupId) => {
    if (groupId !== 'root' && children.length > 0) {
      groupIds.add(groupId);
    }
  });

  // Create ALL task nodes (including those that will be groups and those that are leaf nodes)
  job.tasks.forEach((task) => {
    const isGroup = groupIds.has(task.task_id);

    // Determine parent - find the immediate parent that is a group
    const parts = task.task_id.split('.');
    let parentId: string | undefined = undefined;

    // Start from the immediate parent and walk up to find a valid group parent
    if (parts.length > 1) {
      // Try immediate parent first
      const immediateParent = parts.slice(0, -1).join('.');
      if (groupIds.has(immediateParent)) {
        parentId = immediateParent;
      } else {
        // Walk up the hierarchy to find the nearest ancestor that is a group
        for (let i = parts.length - 2; i > 0; i--) {
          const potentialParent = parts.slice(0, i).join('.');
          if (groupIds.has(potentialParent)) {
            parentId = potentialParent;
            break;
          }
        }
      }
    }

    if (isGroup) {
      // This is a sub-flow (flow node)
      const children = groups.get(task.task_id) || [];
      nodes.push({
        id: task.task_id,
        type: 'flow',
        position: { x: 0, y: 0 },
        data: {
          id: task.task_id,
          label: task.name || task.task_id,
          state: task.state,
          taskCount: children.length,
          description: task.description,
        },
        ...(parentId ? { parentNode: parentId } : {}),
      });
    } else {
      // This is a leaf task node
      nodes.push({
        id: task.task_id,
        type: 'task',
        position: { x: 0, y: 0 },
        data: task,
        ...(parentId ? { parentNode: parentId } : {}),
        extent: parentId ? 'parent' as const : undefined,
      });
    }
  });

  // Create edges from dependencies
  // Allow edges between any nodes (flows and tasks)
  job.dependencies.forEach((dep: TaskDependency, index) => {
    edges.push({
      id: `e-${dep.source}-${dep.target}-${index}`,
      source: dep.source,
      target: dep.target,
      animated: dep.source_output !== null,
      style: { strokeWidth: 2 },
    });
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
        { direction: layoutDirection }
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
