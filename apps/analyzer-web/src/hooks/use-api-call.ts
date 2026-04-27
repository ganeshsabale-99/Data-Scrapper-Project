import { useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook to prevent duplicate API calls
 * @param apiCall - The API function to call
 * @param dependencies - Dependencies array for the API call
 * @returns A memoized API call function
 */
export function useApiCall<T extends (...args: unknown[]) => Promise<unknown>>(
  apiCall: T,
  dependencies: React.DependencyList
): T {
  const lastCallRef = useRef<{
    args: Parameters<T>;
    timestamp: number;
    promise: ReturnType<T>;
  } | null>(null);

  const DEBOUNCE_TIME = 100; // 100ms debounce

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const lastCall = lastCallRef.current;

      // If the same call was made recently with the same arguments, return the existing promise
      if (
        lastCall &&
        now - lastCall.timestamp < DEBOUNCE_TIME &&
        JSON.stringify(args) === JSON.stringify(lastCall.args)
      ) {
        return lastCall.promise;
      }

      // Make the new API call
      const promise = apiCall(...args);

      // Store the call details
      lastCallRef.current = {
        args,
        timestamp: now,
        promise: promise as ReturnType<T>,
      };

      return promise;
    }) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiCall, ...dependencies]
  );
}

/**
 * Hook to prevent multiple simultaneous calls to the same API endpoint
 */
export function useDebouncedApiCall<T extends (...args: unknown[]) => Promise<unknown>>(
  apiCall: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const promiseRef = useRef<Promise<Awaited<ReturnType<T>>> | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // If there's already a pending promise, return it
      if (promiseRef.current) {
        return promiseRef.current;
      }

      // Create a new promise that will be resolved after the delay
      const promise = new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
        timeoutRef.current = setTimeout(async () => {
          try {
            const result = await apiCall(...args);
            resolve(result as Awaited<ReturnType<T>>);
          } catch (error) {
            reject(error);
          } finally {
            promiseRef.current = null;
          }
        }, delay);
      });

      promiseRef.current = promise;
      return promise;
    }) as T,
    [apiCall, delay]
  );
}

/**
 * Hook to manage API calls with automatic cancellation and deduplication
 */
export function useApiCallWithCancellation<T extends (...args: unknown[]) => Promise<unknown>>(
  apiCall: T,
  dependencies: React.DependencyList
) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastCallRef = useRef<{
    args: Parameters<T>;
    timestamp: number;
    promise: ReturnType<T>;
  } | null>(null);

  const DEBOUNCE_TIME = 100; // 100ms debounce

  const callApi = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const lastCall = lastCallRef.current;

      // If the same call was made recently with the same arguments, return the existing promise
      if (
        lastCall &&
        now - lastCall.timestamp < DEBOUNCE_TIME &&
        JSON.stringify(args) === JSON.stringify(lastCall.args)
      ) {
        return lastCall.promise;
      }

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Make the new API call
      const promise = apiCall(...args);

      // Store the call details
      lastCallRef.current = {
        args,
        timestamp: now,
        promise: promise as ReturnType<T>,
      };

      return promise;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiCall, ...dependencies]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return callApi;
}
