import { useJobFlat, useRetryTask, useRetryAllFailed } from '../api';
import type { RetryRequest } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

/**
 * Job Detail Component (deprecated - use JobDetailPage route instead)
 * This component shows job details with retry functionality
 */
export function JobDetail({ jobId }: { jobId: string }) {
  // Query: Get job details (flat format)
  const { data: job, isLoading, error } = useJobFlat(jobId, {
    refetchInterval: 2000,
  });

  // Mutation: Retry specific task
  const retryTask = useRetryTask({
    onSuccess: (data) => {
      console.log('Task retry triggered:', data.message);
    },
  });

  // Mutation: Retry all failed tasks
  const retryAllFailed = useRetryAllFailed({
    onSuccess: (data) => {
      console.log('Retry all triggered:', data.message);
    },
  });

  const handleRetryTask = (taskId: string) => {
    const request: RetryRequest = {
      task_id: taskId,
      reset_downstream: true,
      max_concurrency: 4,
    };
    retryTask.mutate({ jobId, request });
  };

  const handleRetryAllFailed = () => {
    retryAllFailed.mutate({ jobId, maxConcurrency: 4 });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Error: {error.detail}</AlertDescription>
      </Alert>
    );
  }

  if (!job) {
    return null;
  }

  const failedTasks = job.tasks.filter((t) => t.state === 'failed');
  const hasFailedTasks = failedTasks.length > 0;

  const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    running: 'default',
    completed: 'outline',
    successful: 'outline',
    failed: 'destructive',
    skipped: 'secondary',
  };

  return (
    <div className="space-y-6">
      {/* Job Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{job.flow_name}</CardTitle>
              <CardDescription>{job.run_id}</CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <Badge variant={statusColors[job.state.toLowerCase()] || 'outline'}>
                {job.state}
              </Badge>
              {hasFailedTasks && (
                <Button
                  onClick={handleRetryAllFailed}
                  disabled={retryAllFailed.isPending}
                  variant="destructive"
                  size="sm"
                >
                  {retryAllFailed.isPending
                    ? 'Retrying...'
                    : `Retry All Failed (${failedTasks.length})`}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-5 gap-4">
            <StatCard label="Total" value={job.total_tasks} />
            <StatCard label="Successful" value={job.successful_tasks} color="text-green-600" />
            <StatCard label="Failed" value={job.failed_tasks} color="text-red-600" />
            <StatCard label="Running" value={job.running_tasks} color="text-yellow-600" />
            <StatCard label="Pending" value={job.pending_tasks || 0} color="text-blue-600" />
          </div>

          {job.duration_ms && (
            <div className="mt-4 text-sm text-muted-foreground">
              Duration: {(job.duration_ms / 1000).toFixed(2)}s
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>{job.tasks.length} task(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {job.tasks.map((task) => {
            const depth = (task.task_id.match(/\./g) || []).length;

            return (
              <div
                key={task.id}
                className="border rounded-lg p-3 hover:bg-accent transition-colors"
                style={{ marginLeft: `${depth * 16}px` }}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {task.name || task.task_id}
                      </span>
                      <Badge variant={statusColors[task.state.toLowerCase()] || 'outline'} className="text-xs">
                        {task.state}
                      </Badge>
                    </div>

                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Type: {task.task_type}</span>
                      {task.duration_ms && (
                        <span>Duration: {(task.duration_ms / 1000).toFixed(2)}s</span>
                      )}
                      {task.attempt_number > 1 && (
                        <span>Attempt: {task.attempt_number}</span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                    )}

                    {task.error_message && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {task.error_message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {task.state === 'failed' && (
                    <Button
                      onClick={() => handleRetryTask(task.task_id)}
                      disabled={retryTask.isPending}
                      variant="outline"
                      size="sm"
                    >
                      {retryTask.isPending ? 'Retrying...' : 'Retry'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'text-foreground'
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
