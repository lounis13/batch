import {useJobs, useTriggerJob} from '../api';

/**
 * Example: Jobs List Component
 * Demonstrates declarative API usage with React Query
 */
export function JobsList() {
    // Query: Get all jobs with automatic refetching and caching
    const {data, isLoading, error, refetch} = useJobs(undefined, {
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

    if (isLoading) {
        return <div>Loading jobs...</div>;
    }

    if (error) {
        return <div>Error: {error.detail}</div>;
    }

    if (!data) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Jobs</h2>
                <button
                    onClick={() => triggerJob.mutate()}
                    disabled={triggerJob.isPending}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                    {triggerJob.isPending ? 'Triggering...' : 'Trigger New Job'}
                </button>
            </div>

            {/* Aggregated Stats */}
            <div className="grid grid-cols-6 gap-4">
                <StatCard
                    label="Total"
                    value={data.aggregated_stats.total}
                    color="gray"
                />
                <StatCard
                    label="Scheduled"
                    value={data.aggregated_stats.scheduled}
                    color="blue"
                />
                <StatCard
                    label="Running"
                    value={data.aggregated_stats.running}
                    color="yellow"
                />
                <StatCard
                    label="Completed"
                    value={data.aggregated_stats.completed}
                    color="green"
                />
                <StatCard
                    label="Failed"
                    value={data.aggregated_stats.failed}
                    color="red"
                />
                <StatCard
                    label="Skipped"
                    value={data.aggregated_stats.skipped}
                    color="gray"
                />
            </div>

            {/* Jobs List */}
            <div className="space-y-2">
                {data.jobs.map((job) => (
                    <div
                        key={job.job_id}
                        className="border rounded p-4 hover:bg-gray-50"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold">{job.job_id}</h3>
                                <p className="text-sm text-gray-600">
                                    Status: <StatusBadge status={job.status}/>
                                </p>
                                {job.duration && (
                                    <p className="text-xs text-gray-500">
                                        Duration: {job.duration.toFixed(2)}s
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-5 gap-2 text-xs">
                                <div>Total: {job.stats.total}</div>
                                <div>Running: {job.stats.running}</div>
                                <div>Completed: {job.stats.completed}</div>
                                <div>Failed: {job.stats.failed}</div>
                                <div>Skipped: {job.stats.skipped}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatCard({
                      label,
                      value,
                      color,
                  }: {
    label: string;
    value: number;
    color: string;
}) {
    return (
        <div className={`border rounded p-3 bg-${color}-50`}>
            <div className="text-xs text-gray-600">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    );
}

function StatusBadge({status}: { status: string }) {
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
