import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';

export interface SubFlowNodeData {
  id: string;
  label: string;
  state: string;
  taskCount: number;
  description?: string;
  isHorizontal?: boolean;
}

/**
 * SubFlow Node Component for ReactFlow
 * Displays a subflow/group with shadcn components
 */
export const SubFlowNode = memo(({ data }: NodeProps<SubFlowNodeData>) => {
  const isHorizontal = data.isHorizontal || false;

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 border-gray-400',
    scheduled: 'bg-blue-100 border-blue-400',
    running: 'bg-yellow-100 border-yellow-400',
    completed: 'bg-green-100 border-green-400',
    successful: 'bg-green-100 border-green-400',
    failed: 'bg-red-100 border-red-400',
    skipped: 'bg-gray-100 border-gray-300',
  };

  const statusColor = statusColors[data.state.toLowerCase()] || 'bg-gray-100 border-gray-400';

  const sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
  const targetPosition = isHorizontal ? Position.Left : Position.Top;

  return (
    <div className="subflow-node">
      <Handle type="target" position={targetPosition} className="w-3 h-3" />

      <Card className={`min-w-[250px] max-w-[350px] ${statusColor} border-2`}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <CardTitle className="text-sm font-bold">{data.label}</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              {data.state}
            </Badge>
          </div>
          {data.description && (
            <p className="text-xs text-muted-foreground mt-1">{data.description}</p>
          )}
        </CardHeader>

        <CardContent className="p-3 pt-0">
          <div className="text-xs text-muted-foreground">
            {data.taskCount} task(s)
          </div>
        </CardContent>
      </Card>

      <Handle type="source" position={sourcePosition} className="w-3 h-3" />
    </div>
  );
});

SubFlowNode.displayName = 'SubFlowNode';
