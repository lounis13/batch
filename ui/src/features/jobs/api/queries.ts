import { QueryFactory } from '@/lib/api/query-factory';
import {
  AllJobsResponseSchema,
  JobDetailFlatSchema,
  JobDetailSchema,
  RetryResponseSchema,
  RetryAllResponseSchema,
  TriggerJobResponseSchema,
  type RetryRequest,
  type RetryResponse,
  type RetryAllResponse,
} from './schemas';

/**
 * Query Keys Factory
 */
export const jobsKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobsKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...jobsKeys.lists(), filters] as const,
  details: () => [...jobsKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobsKeys.details(), id] as const,
  detailFlat: (id: string) => [...jobsKeys.detail(id), 'flat'] as const,
  detailHierarchical: (id: string) => [...jobsKeys.detail(id), 'hierarchical'] as const,
} as const;

/**
 * Query Hooks
 */

/**
 * Get all jobs
 * @example
 * const { data, isLoading, error } = useJobs();
 */
export const useJobs = QueryFactory.createQuery({
  queryKey: jobsKeys.lists(),
  endpoint: '/jobs',
  schema: AllJobsResponseSchema,
});

/**
 * Get job details (flat format)
 * @example
 * const { data, isLoading } = useJobFlat('job-123');
 */
export const useJobFlat = QueryFactory.createQuery({
  queryKey: (jobId: string) => jobsKeys.detailFlat(jobId),
  endpoint: (jobId: string) => `/jobs/${jobId}`,
  schema: JobDetailFlatSchema,
});

/**
 * Get job details (hierarchical format)
 * @example
 * const { data, isLoading } = useJobHierarchical('job-123');
 */
export const useJobHierarchical = QueryFactory.createQuery({
  queryKey: (jobId: string) => jobsKeys.detailHierarchical(jobId),
  endpoint: (jobId: string) => `/jobs/${jobId}/flow`,
  schema: JobDetailSchema,
});

/**
 * Mutation Hooks
 */

/**
 * Trigger a new job
 * @example
 * const triggerJob = useTriggerJob();
 * triggerJob.mutate();
 */
export const useTriggerJob = QueryFactory.createMutation({
  endpoint: '/jobs',
  schema: TriggerJobResponseSchema,
  invalidateKeys: [jobsKeys.lists()],
});

/**
 * Retry a specific task
 * @example
 * const retryTask = useRetryTask();
 * retryTask.mutate({
 *   jobId: 'job-123',
 *   request: { task_id: 'task-1', reset_downstream: true }
 * });
 */
export const useRetryTask = QueryFactory.createMutation<
  RetryResponse,
  { jobId: string; request: RetryRequest }
>({
  endpoint: ({ jobId }) => `/jobs/${jobId}/retry`,
  schema: RetryResponseSchema,
  invalidateKeys: [jobsKeys.all],
});

/**
 * Retry all failed tasks
 * @example
 * const retryAll = useRetryAllFailed();
 * retryAll.mutate({ jobId: 'job-123', maxConcurrency: 4 });
 */
export const useRetryAllFailed = QueryFactory.createMutation<
  RetryAllResponse,
  { jobId: string; maxConcurrency?: number }
>({
  endpoint: ({ jobId, maxConcurrency = 4 }) =>
    `/jobs/${jobId}/retry-all?max_concurrency=${maxConcurrency}`,
  schema: RetryAllResponseSchema,
  invalidateKeys: [jobsKeys.all],
});

/**
 * Composite hook for job operations
 * Provides all job-related queries and mutations in one place
 * @example
 * const jobs = useJobOperations();
 * jobs.query.getAll(); // Get all jobs
 * jobs.mutations.trigger(); // Trigger a job
 */
export const useJobOperations = () => ({
  query: {
    getAll: useJobs,
    getFlat: useJobFlat,
    getHierarchical: useJobHierarchical,
  },
  mutations: {
    trigger: useTriggerJob,
    retryTask: useRetryTask,
    retryAllFailed: useRetryAllFailed,
  },
  keys: jobsKeys,
});
