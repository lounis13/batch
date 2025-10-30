import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle } from 'lucide-react';
import type { FlatTask } from '../../api';

export type TaskNodeData = FlatTask & {
  isHorizontal?: boolean;
};

/**
 * Task Node Component for ReactFlow
 * Displays a single task with shadcn components
 */
export const TaskNode = memo(({ data }: NodeProps<TaskNodeData>) => {
  const isHorizontal = data.isHorizontal || false;

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-200 text-gray-700',
    scheduled: 'bg-blue-200 text-blue-700',
    running: 'bg-yellow-200 text-yellow-700',
    completed: 'bg-green-200 text-green-700',
    successful: 'bg-green-200 text-green-700',
    failed: 'bg-red-200 text-red-700',
    skipped: 'bg-gray-200 text-gray-500',
  };

  const statusColor = statusColors[data.state.toLowerCase()] || 'bg-gray-200 text-gray-700';

  const sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
  const targetPosition = isHorizontal ? Position.Left : Position.Top;

  return (
    <div className="task-node">
      <Handle type="target" position={targetPosition} className="w-3 h-3" />

      <Card className={`min-w-[200px] max-w-[300px] ${statusColor} border-2`}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold">
              {data.name || data.task_id}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {data.state}
            </Badge>
          </div>
          {data.description && (
            <p className="text-xs text-muted-foreground mt-1">{data.description}</p>
          )}
        </CardHeader>

        <CardContent className="p-3 pt-0 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{data.task_type}</span>
          </div>

          {data.duration_ms && (
            <div className="flex items-center gap-1 text-xs">
              <Clock className="w-3 h-3" />
              <span>{(data.duration_ms / 1000).toFixed(2)}s</span>
            </div>
          )}

          {data.error_message && (
            <div className="flex items-start gap-1 text-xs text-red-600">
              <AlertCircle className="w-3 h-3 mt-0.5" />
              <span className="line-clamp-2">{data.error_message}</span>
            </div>
          )}

          {data.attempt_number > 1 && (
            <div className="text-xs text-muted-foreground">
              Attempt: {data.attempt_number}
            </div>
          )}
        </CardContent>
      </Card>

      <Handle type="source" position={sourcePosition} className="w-3 h-3" />
    </div>
  );
});

TaskNode.displayName = 'TaskNode';
