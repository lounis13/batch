import { apiClient } from '@/lib/api/client';
import {
  AllJobsResponseSchema,
  JobDetailFlatSchema,
  JobDetailSchema,
  RetryRequestSchema,
  RetryResponseSchema,
  RetryAllResponseSchema,
  TriggerJobResponseSchema,
  type AllJobsResponse,
  type JobDetailFlat,
  type JobDetail,
  type RetryRequest,
  type RetryResponse,
  type RetryAllResponse,
  type TriggerJobResponse,
} from './schemas';

/**
 * Jobs API Service
 * Declarative API service with automatic Zod validation
 */
export const jobsService = {
  /**
   * Get all jobs with summary information
   */
  getAll: () =>
    apiClient.get<AllJobsResponse>('/jobs', AllJobsResponseSchema),

  /**
   * Trigger a new job
   */
  trigger: () =>
    apiClient.post<TriggerJobResponse>('/jobs', TriggerJobResponseSchema),

  /**
   * Get job details (flat format)
   */
  getJobFlat: (jobId: string) =>
    apiClient.get<JobDetailFlat>(`/jobs/${jobId}`, JobDetailFlatSchema),

  /**
   * Get job details (hierarchical format)
   */
  getJobHierarchical: (jobId: string) =>
    apiClient.get<JobDetail>(`/jobs/${jobId}/flow`, JobDetailSchema),

  /**
   * Retry a specific task
   */
  retryTask: (jobId: string, request: RetryRequest) =>
    apiClient.post<RetryResponse>(
      `/jobs/${jobId}/retry`,
      RetryResponseSchema,
      request
    ),

  /**
   * Retry all failed tasks in a job
   */
  retryAllFailed: (jobId: string, maxConcurrency: number = 4) =>
    apiClient.post<RetryAllResponse>(
      `/jobs/${jobId}/retry-all?max_concurrency=${maxConcurrency}`,
      RetryAllResponseSchema
    ),
} as const;
