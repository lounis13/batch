import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Eye } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import type { JobSummary } from '../api';

/**
 * Status Badge Component with shadcn
 */
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    running: 'default',
    completed: 'outline',
    failed: 'destructive',
    skipped: 'secondary',
  };

  return (
    <Badge variant={variants[status.toLowerCase()] || 'outline'}>
      {status}
    </Badge>
  );
}

/**
 * Jobs Table Columns Definition
 * Declarative column configuration with sorting and navigation
 */
export const jobsColumns: ColumnDef<JobSummary>[] = [
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const navigate = useNavigate();
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: row.original.run_id } })}
        >
          <Eye className="h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: 'flow_name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Flow Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.getValue('flow_name')}</div>
        <div className="text-xs text-muted-foreground">{row.original.run_id}</div>
      </div>
    ),
  },
  {
    accessorKey: 'state',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <StatusBadge status={row.getValue('state')} />,
  },
  {
    accessorKey: 'total_tasks',
    header: 'Tasks',
    cell: ({ row }) => {
      const job = row.original;
      return (
        <div className="space-y-1">
          <div className="flex gap-2 text-xs">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">{job.total_tasks}</span>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="text-green-600">✓ {job.successful_tasks}</span>
            <span className="text-red-600">✗ {job.failed_tasks}</span>
            <span className="text-yellow-600">⟳ {job.running_tasks}</span>
            <span className="text-gray-400">○ {job.pending_tasks}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'duration_ms',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Duration
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const duration = row.getValue('duration_ms') as number | null;
      if (!duration) return <span className="text-muted-foreground">-</span>;
      return <span>{(duration / 1000).toFixed(2)}s</span>;
    },
  },
  {
    accessorKey: 'start_timestamp',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Started
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const timestamp = row.getValue('start_timestamp') as string | null;
      if (!timestamp) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="text-xs">
          {new Date(timestamp).toLocaleString()}
        </div>
      );
    },
  },
];
