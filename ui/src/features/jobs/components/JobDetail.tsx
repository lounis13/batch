import { useJobFlat, useRetryTask, useRetryAllFailed } from '../api';
import type { RetryRequest } from '../api';

/**
 * Example: Job Detail Component
 * Demonstrates job detail view with retry functionality
 */
export function JobDetail({ jobId }: { jobId: string }) {
  // Query: Get job details (flat format for easy rendering)
  const { data: job, isLoading, error } = useJobFlat(jobId, {
    refetchInterval: 2000, // Auto-refresh every 2 seconds
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
    return <div>Loading job details...</div>;
  }

  if (error) {
    return <div>Error: {error.detail}</div>;
  }

  if (!job) {
    return null;
  }

  const failedTasks = job.tasks.filter((t) => t.status === 'failed');
  const hasFailedTasks = failedTasks.length > 0;

  return (
    <div className="space-y-6">
      {/* Job Header */}
      <div className="border rounded p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">{job.job_id}</h2>
            <p className="text-sm text-gray-600">
              Status: <StatusBadge status={job.status} />
            </p>
            {job.duration && (
              <p className="text-xs text-gray-500">
                Duration: {job.duration.toFixed(2)}s
              </p>
            )}
          </div>
          {hasFailedTasks && (
            <button
              onClick={handleRetryAllFailed}
              disabled={retryAllFailed.isPending}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {retryAllFailed.isPending
                ? 'Retrying...'
                : `Retry All Failed (${failedTasks.length})`}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-6 gap-4 mt-4">
          <StatItem label="Total" value={job.stats.total} />
          <StatItem label="Scheduled" value={job.stats.scheduled} />
          <StatItem label="Running" value={job.stats.running} />
          <StatItem label="Completed" value={job.stats.completed} />
          <StatItem label="Failed" value={job.stats.failed} />
          <StatItem label="Skipped" value={job.stats.skipped} />
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Tasks</h3>
        {job.tasks.map((task) => (
          <div
            key={task.id}
            className="border rounded p-3 hover:bg-gray-50"
            style={{ marginLeft: `${task.depth * 20}px` }}
          >
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{task.name}</span>
                  <StatusBadge status={task.status} />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  <span>Path: {task.path}</span>
                  {task.duration && (
                    <span className="ml-4">
                      Duration: {task.duration.toFixed(2)}s
                    </span>
                  )}
                </div>
                {task.error && (
                  <div className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded">
                    Error: {task.error}
                  </div>
                )}
                {task.dependencies.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Dependencies: {task.dependencies.join(', ')}
                  </div>
                )}
              </div>
              {task.status === 'failed' && (
                <button
                  onClick={() => handleRetryTask(task.id)}
                  disabled={retryTask.isPending}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {retryTask.isPending ? 'Retrying...' : 'Retry'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800',
    running: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    skipped: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-semibold ${
        colors[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {status}
    </span>
  );
}
