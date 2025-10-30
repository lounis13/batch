import { useState, useEffect, useCallback } from 'react';
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
import type { JobDetailFlat } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowRight, Loader2, Network } from 'lucide-react';
import { buildFlowGraph } from '../utils/flow-graph-builder';
import { LayoutEngine, type LayoutDirection, type LayoutAlgorithm } from '../utils/layout-engine';

const nodeTypes = {
  task: TaskNode,
  flow: SubFlowNode,
};

interface FlowVisualizationProps {
  job: JobDetailFlat;
}

/**
 * Flow Visualization Component (v2 - Robust Implementation)
 *
 * Features:
 * - Clean separation of concerns (graph building, layout, rendering)
 * - Robust handling of hierarchical flows
 * - Proper ELK layout with all edges visible
 * - Error handling and loading states
 * - Configurable layout direction
 */
export function FlowVisualizationV2({ job }: FlowVisualizationProps) {
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<LayoutAlgorithm>('elk');
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('DOWN');
  const [isLayouting, setIsLayouting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Compute layout whenever job, algorithm, or direction changes
  useEffect(() => {
    const computeLayout = async () => {
      try {
        setIsLayouting(true);
        setError(null);

        // Step 1: Build graph from job data
        const graph = buildFlowGraph(job);

        // Step 2: Compute layout using selected algorithm
        const layoutEngine = new LayoutEngine({
          algorithm: layoutAlgorithm,
          direction: layoutDirection,
          nodeSpacing: 80,
          layerSpacing: 100,
        });

        const layoutedGraph = await layoutEngine.layout(graph.nodes, graph.edges);

        // Step 3: Update state
        setNodes(layoutedGraph.nodes);
        setEdges(layoutedGraph.edges);

      } catch (err) {
        console.error('Failed to compute layout:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLayouting(false);
      }
    };

    computeLayout();
  }, [job, layoutAlgorithm, layoutDirection, setNodes, setEdges]);

  const handleAlgorithmChange = useCallback((value: LayoutAlgorithm) => {
    setLayoutAlgorithm(value);
  }, []);

  const handleLayoutChange = useCallback((value: LayoutDirection) => {
    setLayoutDirection(value);
  }, []);

  const handleFitView = useCallback(() => {
    // Trigger fit view (handled by ReactFlow)
  }, []);

  // Node color based on state
  const getNodeColor = (node: Node): string => {
    const state = node.data?.state;
    if (!state || typeof state !== 'string') return '#94a3b8';

    const colors: Record<string, string> = {
      completed: '#22c55e',
      successful: '#22c55e',
      success: '#22c55e',
      running: '#eab308',
      failed: '#ef4444',
      pending: '#94a3b8',
      scheduled: '#3b82f6',
      skipped: '#64748b',
    };
    return colors[state.toLowerCase()] || '#94a3b8';
  };

  if (error) {
    return (
      <Card className="h-[calc(100vh-200px)]">
        <CardHeader>
          <CardTitle className="text-destructive">Layout Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Failed to compute layout: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[calc(100vh-200px)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <CardTitle>Workflow Execution</CardTitle>
        <div className="flex gap-2">
          {/* Algorithm Selector */}
          <Select value={layoutAlgorithm} onValueChange={handleAlgorithmChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Algorithm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="elk">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4" />
                  ELK Layout
                </div>
              </SelectItem>
              <SelectItem value="dagre">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4" />
                  Dagre Layout
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Direction Selector */}
          <Select value={layoutDirection} onValueChange={handleLayoutChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Direction" />
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleFitView}
            disabled={isLayouting}
          >
            Fit View
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="h-[calc(100vh-280px)] relative">
          {isLayouting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Computing layout...</span>
              </div>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{
              padding: 0.2,
              minZoom: 0.1,
              maxZoom: 1.5,
            }}
            minZoom={0.05}
            maxZoom={2}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
              style: { strokeWidth: 2 },
            }}
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={getNodeColor}
              pannable
              zoomable
              className="bg-background border border-border"
            />
          </ReactFlow>
        </div>
      </CardContent>

      {/* Stats Footer */}
      <div className="px-6 py-3 border-t flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <span className="text-muted-foreground">
            Algorithm: <span className="font-medium text-foreground uppercase">{layoutAlgorithm}</span>
          </span>
          <span className="text-muted-foreground">
            Nodes: <span className="font-medium text-foreground">{nodes.length}</span>
          </span>
          <span className="text-muted-foreground">
            Edges: <span className="font-medium text-foreground">{edges.length}</span>
          </span>
          <span className="text-muted-foreground">
            Flows: <span className="font-medium text-foreground">
              {nodes.filter(n => n.type === 'flow').length}
            </span>
          </span>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-muted-foreground">Success</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-muted-foreground">Running</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-muted-foreground">Failed</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
