import { z } from 'zod';

/**
 * Task Status Enum
 */
export const TaskStatusSchema = z.enum([
  'scheduled',
  'running',
  'completed',
  'failed',
  'skipped',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Task Schema
 */
export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: TaskStatusSchema,
  error: z.string().optional().nullable(),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  duration: z.number().optional().nullable(),
  result: z.any().optional().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;

/**
 * Flat Task Schema (API format)
 */
export const FlatTaskSchema = z.object({
  id: z.string(),
  task_id: z.string(),
  task_type: z.string(),
  state: z.string(),
  attempt_number: z.number(),
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  input_data: z.record(z.any()).optional().nullable(),
  output_data: z.record(z.any()).optional().nullable(),
  error_message: z.string().optional().nullable(),
  start_timestamp: z.string().optional().nullable(),
  end_timestamp: z.string().optional().nullable(),
  duration_ms: z.number().optional().nullable(),
});
export type FlatTask = z.infer<typeof FlatTaskSchema>;

/**
 * Task Dependency Schema
 */
export const TaskDependencySchema = z.object({
  source: z.string(),
  target: z.string(),
  source_id: z.string().optional().nullable(),
  target_id: z.string().optional().nullable(),
  source_output: z.any().optional().nullable(),
  target_input: z.any().optional().nullable(),
});
export type TaskDependency = z.infer<typeof TaskDependencySchema>;

/**
 * Flow Node Schema (hierarchical)
 */
export const FlowNodeSchema: z.ZodSchema<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    status: TaskStatusSchema,
    error: z.string().optional().nullable(),
    start_time: z.string().optional().nullable(),
    end_time: z.string().optional().nullable(),
    duration: z.number().optional().nullable(),
    result: z.any().optional().nullable(),
    children: z.array(FlowNodeSchema).optional(),
    dependencies: z.array(z.string()).optional(),
  })
);
export type FlowNode = z.infer<typeof FlowNodeSchema>;

/**
 * Job Statistics Schema
 */
export const JobStatsSchema = z.object({
  total: z.number(),
  scheduled: z.number(),
  running: z.number(),
  completed: z.number(),
  failed: z.number(),
  skipped: z.number(),
});
export type JobStats = z.infer<typeof JobStatsSchema>;

/**
 * Job Summary Schema
 */
export const JobSummarySchema = z.object({
  run_id: z.string(),
  flow_name: z.string(),
  state: z.string(),
  start_timestamp: z.string().optional().nullable(),
  end_timestamp: z.string().optional().nullable(),
  duration_ms: z.number().optional().nullable(),
  parent_run_id: z.string().optional().nullable(),
  total_tasks: z.number(),
  successful_tasks: z.number(),
  failed_tasks: z.number(),
  running_tasks: z.number(),
  pending_tasks: z.number(),
});
export type JobSummary = z.infer<typeof JobSummarySchema>;

/**
 * Job List Stats Schema
 */
export const JobListStatsSchema = z.object({
  total_jobs: z.number(),
  running_jobs: z.number(),
  successful_jobs: z.number(),
  failed_jobs: z.number(),
  pending_jobs: z.number(),
  total_tasks_across_all_jobs: z.number(),
  total_duration_ms: z.number().optional().nullable(),
  average_duration_ms: z.number().optional().nullable(),
});
export type JobListStats = z.infer<typeof JobListStatsSchema>;

/**
 * All Jobs Response Schema
 */
export const AllJobsResponseSchema = z.object({
  jobs: z.array(JobSummarySchema),
  stats: JobListStatsSchema.optional().nullable(),
  total_count: z.number(),
});
export type AllJobsResponse = z.infer<typeof AllJobsResponseSchema>;

/**
 * Job Detail (Flat) Schema
 */
export const JobDetailFlatSchema = z.object({
  job_id: z.string(),
  status: TaskStatusSchema,
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  duration: z.number().optional().nullable(),
  params: z.record(z.any()),
  tasks: z.array(FlatExecutionTaskSchema),
  stats: JobStatsSchema,
});
export type JobDetailFlat = z.infer<typeof JobDetailFlatSchema>;

/**
 * Job Detail (Hierarchical) Schema
 */
export const JobDetailSchema = z.object({
  job_id: z.string(),
  status: TaskStatusSchema,
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  duration: z.number().optional().nullable(),
  params: z.record(z.any()),
  flow: FlowNodeSchema,
  stats: JobStatsSchema,
});
export type JobDetail = z.infer<typeof JobDetailSchema>;

/**
 * Retry Request Schema
 */
export const RetryRequestSchema = z.object({
  task_id: z.string(),
  reset_downstream: z.boolean().default(true),
  max_concurrency: z.number().int().min(1).default(4),
});
export type RetryRequest = z.infer<typeof RetryRequestSchema>;

/**
 * Retry Response Schema
 */
export const RetryResponseSchema = z.object({
  message: z.string(),
  job_id: z.string(),
  task_id: z.string(),
  reset_downstream: z.boolean(),
  max_concurrency: z.number(),
});
export type RetryResponse = z.infer<typeof RetryResponseSchema>;

/**
 * Retry All Response Schema
 */
export const RetryAllResponseSchema = z.object({
  message: z.string(),
  job_id: z.string(),
  failed_tasks: z.array(z.string()),
  max_concurrency: z.number(),
});
export type RetryAllResponse = z.infer<typeof RetryAllResponseSchema>;

/**
 * Trigger Job Response Schema
 */
export const TriggerJobResponseSchema = z.string();
export type TriggerJobResponse = z.infer<typeof TriggerJobResponseSchema>;
