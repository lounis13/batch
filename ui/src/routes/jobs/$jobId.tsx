import { createFileRoute } from '@tanstack/react-router';
import { useJobFlat } from '@/features/jobs/api';
import { FlowVisualizationV2 } from '@/features/jobs/components/FlowVisualization-v2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export const Route = createFileRoute('/jobs/$jobId')({
  component: JobDetailPage,
});

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const navigate = Route.useNavigate();

  console.log('[JobDetailPage] Rendering with jobId:', jobId);

  const { data: job, isLoading, error, refetch } = useJobFlat(jobId, {
    refetchInterval: 5000,
    enabled: !!jobId,
  });

  console.log('[JobDetailPage] Query state:', { isLoading, error, hasData: !!job });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[600px] w-full" />
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/' })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{job.flow_name}</h2>
            <p className="text-sm text-muted-foreground">{job.run_id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Badge variant={statusColors[job.state.toLowerCase()] || 'outline'}>
            {job.state}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tasks</CardDescription>
            <CardTitle className="text-2xl">{job.total_tasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Successful</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {job.successful_tasks}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-2xl text-red-600">
              {job.failed_tasks}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Running</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">
              {job.running_tasks}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Duration */}
      {job.duration_ms && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Duration</CardDescription>
            <CardTitle className="text-xl">
              {(job.duration_ms / 1000).toFixed(2)} seconds
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Flow Visualization */}
      <FlowVisualizationV2 job={job} />
    </div>
  );
}
