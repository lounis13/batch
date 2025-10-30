import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from './client';
import type { ApiError, QueryConfig, MutationConfig } from './types';

/**
 * Generic Query Factory
 * Creates type-safe React Query hooks with Zod validation
 */
export class QueryFactory {
  /**
   * Create a GET query hook
   */
  static createQuery<TData>(config: {
    queryKey: QueryKey | ((...args: any[]) => QueryKey);
    endpoint: string | ((...args: any[]) => string);
    schema: z.ZodSchema<TData>;
  }) {
    return (
      params?: any,
      options?: Omit<UseQueryOptions<TData, ApiError>, 'queryKey' | 'queryFn'>
    ) => {
      const queryKey = typeof config.queryKey === 'function'
        ? config.queryKey(params)
        : config.queryKey;

      const endpoint = typeof config.endpoint === 'function'
        ? config.endpoint(params)
        : config.endpoint;

      return useQuery<TData, ApiError>({
        queryKey,
        queryFn: () => apiClient.get(endpoint, config.schema),
        ...options,
      });
    };
  }

  /**
   * Create a POST mutation hook
   */
  static createMutation<TResponse, TVariables = void>(config: {
    endpoint: string | ((variables: TVariables) => string);
    schema: z.ZodSchema<TResponse>;
    invalidateKeys?: QueryKey[];
  }) {
    return (options?: UseMutationOptions<TResponse, ApiError, TVariables>) => {
      const queryClient = useQueryClient();

      return useMutation<TResponse, ApiError, TVariables>({
        mutationFn: async (variables: TVariables) => {
          const endpoint = typeof config.endpoint === 'function'
            ? config.endpoint(variables)
            : config.endpoint;

          return apiClient.post(endpoint, config.schema, variables);
        },
        onSuccess: (...args) => {
          // Invalidate specified query keys
          config.invalidateKeys?.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
          options?.onSuccess?.(...args);
        },
        ...options,
      });
    };
  }

  /**
   * Create a DELETE mutation hook
   */
  static createDeleteMutation<TResponse, TVariables = string>(config: {
    endpoint: (id: TVariables) => string;
    schema: z.ZodSchema<TResponse>;
    invalidateKeys?: QueryKey[];
  }) {
    return (options?: UseMutationOptions<TResponse, ApiError, TVariables>) => {
      const queryClient = useQueryClient();

      return useMutation<TResponse, ApiError, TVariables>({
        mutationFn: async (variables: TVariables) => {
          const endpoint = config.endpoint(variables);
          return apiClient.delete(endpoint, config.schema);
        },
        onSuccess: (...args) => {
          config.invalidateKeys?.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
          options?.onSuccess?.(...args);
        },
        ...options,
      });
    };
  }
}
