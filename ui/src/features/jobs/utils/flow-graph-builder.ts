import type { Node, Edge } from '@xyflow/react';
import type { JobDetailFlat, FlatTask, TaskDependency } from '../api';

/**
 * Graph Builder for converting job data to React Flow format
 *
 * This module handles the conversion of hierarchical job/task data
 * into a flat graph structure suitable for React Flow visualization.
 */

export interface FlowGraphNode extends Node {
  id: string;
  type: 'task' | 'flow';
  position: { x: number; y: number };
  data: any;
  parentNode?: string;
  extent?: 'parent';
}

export interface FlowGraphEdge extends Edge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  style?: any;
}

export interface FlowGraph {
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
}

/**
 * Build a complete flow graph from job data
 */
export function buildFlowGraph(job: JobDetailFlat): FlowGraph {
  const builder = new FlowGraphBuilder(job);
  return builder.build();
}

class FlowGraphBuilder {
  private job: JobDetailFlat;
  private nodes: FlowGraphNode[] = [];
  private edges: FlowGraphEdge[] = [];
  private flowIds = new Set<string>();
  private taskById = new Map<string, FlatTask>();

  constructor(job: JobDetailFlat) {
    this.job = job;
    this.indexTasks();
    this.identifyFlows();
  }

  /**
   * Index all tasks by ID for quick lookup
   */
  private indexTasks(): void {
    this.job.tasks.forEach(task => {
      this.taskById.set(task.task_id, task);
    });
  }

  /**
   * Identify which tasks are flows (have children or task_type === 'flow')
   */
  private identifyFlows(): void {
    // Method 1: task_type === 'flow'
    this.job.tasks.forEach(task => {
      if (task.task_type === 'flow') {
        this.flowIds.add(task.task_id);
      }
    });

    // Method 2: tasks that have children
    const childrenMap = this.groupTasksByParent();
    childrenMap.forEach((children, parentId) => {
      if (parentId !== 'root' && children.length > 0) {
        this.flowIds.add(parentId);
      }
    });
  }

  /**
   * Group tasks by their parent ID
   */
  private groupTasksByParent(): Map<string, FlatTask[]> {
    const groups = new Map<string, FlatTask[]>();

    this.job.tasks.forEach(task => {
      const parts = task.task_id.split('.');
      const parentId = parts.length > 1 ? parts.slice(0, -1).join('.') : 'root';

      if (!groups.has(parentId)) {
        groups.set(parentId, []);
      }
      groups.get(parentId)!.push(task);
    });

    return groups;
  }

  /**
   * Find the parent flow ID for a task
   */
  private findParentFlow(taskId: string): string | undefined {
    const parts = taskId.split('.');

    if (parts.length <= 1) {
      return undefined; // No parent (root level)
    }

    // Try immediate parent first
    const immediateParent = parts.slice(0, -1).join('.');
    if (this.flowIds.has(immediateParent)) {
      return immediateParent;
    }

    // Walk up the hierarchy to find the nearest flow parent
    for (let i = parts.length - 2; i > 0; i--) {
      const potentialParent = parts.slice(0, i).join('.');
      if (this.flowIds.has(potentialParent)) {
        return potentialParent;
      }
    }

    return undefined;
  }

  /**
   * Create a node for a task or flow
   */
  private createNode(task: FlatTask): FlowGraphNode {
    const isFlow = this.flowIds.has(task.task_id);
    const parentId = this.findParentFlow(task.task_id);
    const childrenMap = this.groupTasksByParent();
    const children = childrenMap.get(task.task_id) || [];

    const node: FlowGraphNode = {
      id: task.task_id,
      type: isFlow ? 'flow' : 'task',
      position: { x: 0, y: 0 }, // Will be set by layout algorithm
      data: isFlow ? {
        id: task.task_id,
        label: task.name || task.task_id,
        state: task.state,
        taskCount: children.length,
        description: task.description,
        taskType: task.task_type,
      } : {
        ...task,
        label: task.name || task.task_id,
      },
    };

    // Set parent relationship
    if (parentId) {
      node.parentNode = parentId;
      node.extent = 'parent';
    }

    return node;
  }

  /**
   * Create an edge from a dependency
   */
  private createEdge(dep: TaskDependency, index: number): FlowGraphEdge {
    return {
      id: `e-${dep.source}-${dep.target}-${index}`,
      source: dep.source,
      target: dep.target,
      animated: dep.source_output !== null,
      style: { strokeWidth: 2 },
    };
  }

  /**
   * Build the complete graph
   */
  build(): FlowGraph {
    // Create nodes for all tasks
    this.job.tasks.forEach(task => {
      const node = this.createNode(task);
      this.nodes.push(node);
    });

    // Create edges from dependencies
    const nodeIds = new Set(this.nodes.map(n => n.id));

    this.job.dependencies.forEach((dep, index) => {
      // Only create edge if both nodes exist
      if (nodeIds.has(dep.source) && nodeIds.has(dep.target)) {
        const edge = this.createEdge(dep, index);
        this.edges.push(edge);
      }
    });

    return {
      nodes: this.nodes,
      edges: this.edges,
    };
  }
}
