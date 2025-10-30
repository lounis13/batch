import { z } from 'zod';

/**
 * Generic API response types
 */
export type ApiResponse<T> = T;
export type ApiError = {
  detail: string;
  status?: number;
};

/**
 * Query configuration types
 */
export interface QueryConfig<TData = unknown> {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  retry?: boolean | number;
  onSuccess?: (data: TData) => void;
  onError?: (error: ApiError) => void;
}

/**
 * Mutation configuration types
 */
export interface MutationConfig<TData = unknown, TVariables = unknown> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: ApiError, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: ApiError | null, variables: TVariables) => void;
}
