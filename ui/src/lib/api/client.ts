import { z } from 'zod';
import type { ApiError } from './types';

/**
 * API Client Configuration
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * Generic API Client with Zod validation
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generic GET request with Zod validation
   */
  async get<T>(endpoint: string, schema: z.ZodSchema<T>): Promise<T> {
    return this.request<T>('GET', endpoint, schema);
  }

  /**
   * Generic POST request with Zod validation
   */
  async post<TResponse, TBody = unknown>(
    endpoint: string,
    schema: z.ZodSchema<TResponse>,
    body?: TBody
  ): Promise<TResponse> {
    return this.request<TResponse>('POST', endpoint, schema, body);
  }

  /**
   * Generic PUT request with Zod validation
   */
  async put<TResponse, TBody = unknown>(
    endpoint: string,
    schema: z.ZodSchema<TResponse>,
    body?: TBody
  ): Promise<TResponse> {
    return this.request<TResponse>('PUT', endpoint, schema, body);
  }

  /**
   * Generic DELETE request with Zod validation
   */
  async delete<T>(endpoint: string, schema: z.ZodSchema<T>): Promise<T> {
    return this.request<T>('DELETE', endpoint, schema);
  }

  /**
   * Core request method with automatic Zod validation
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    schema: z.ZodSchema<T>,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          detail: response.statusText,
          status: response.status,
        }));
        throw error;
      }

      const data = await response.json();

      // Validate response with Zod
      return schema.parse(data);
    } catch (error) {
      if (error && typeof error === 'object' && 'detail' in error) {
        throw error as ApiError;
      }
      throw {
        detail: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 500,
      } as ApiError;
    }
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();
