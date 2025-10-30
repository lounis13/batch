import { useMemo } from 'react';
import { useJobs, useTriggerJob } from '../api';
import { DataTable } from '@/components/data-table';
import { jobsColumns } from './jobs-columns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, RefreshCw } from 'lucide-react';

/**
 * Jobs List Component with DataTable
 * Uses shadcn components and react-table
 */
export function JobsList() {
  // Query: Get all jobs with automatic refetching and caching
  const { data, isLoading, error, refetch } = useJobs(undefined, {
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    staleTime: 3000,
  });

  // Mutation: Trigger a new job
  const triggerJob = useTriggerJob({
    onSuccess: (jobId) => {
      console.log('Job triggered successfully:', jobId);
    },
    onError: (error) => {
      console.error('Failed to trigger job:', error.detail);
    },
  });

  // Filter: Only show parent jobs (jobs without parent_run_id)
  const parentJobs = useMemo(() => {
    if (!data?.jobs) return [];
    return data.jobs.filter((job) => !job.parent_run_id);
  }, [data?.jobs]);

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

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Jobs</h2>
          <p className="text-muted-foreground">
            Manage and monitor your workflow executions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => triggerJob.mutate()}
            disabled={triggerJob.isPending}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            {triggerJob.isPending ? 'Triggering...' : 'Trigger Job'}
          </Button>
        </div>
      </div>

      {/* Aggregated Stats */}
      {data.stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Jobs</CardDescription>
              <CardTitle className="text-3xl">{data.stats.total_jobs}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Running</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">
                {data.stats.running_jobs}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Successful</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {data.stats.successful_jobs}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failed</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                {data.stats.failed_jobs}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {data.stats.pending_jobs}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Jobs</CardTitle>
          <CardDescription>
            Showing {parentJobs.length} parent job(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={jobsColumns}
            data={parentJobs}
            searchable={{
              column: 'flow_name',
              placeholder: 'Search by flow name...',
            }}
            pagination={true}
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );
}
