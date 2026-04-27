import { useMemo } from "react";

type MutationError = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
};

type MutationLike = {
  isPending?: boolean;
  isError?: boolean;
  error?: unknown;
  isSuccess?: boolean;
};

const isMutationError = (value: unknown): value is MutationError => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as MutationError;
  return (
    typeof candidate.message === "string" ||
    typeof candidate.response?.status === "number" ||
    typeof candidate.response?.data?.message === "string" ||
    typeof candidate.response?.data?.error === "string"
  );
};

/**
 * Professional operation status hook
 * Provides comprehensive loading and error states for mutations
 */
export const useOperationStatus = (mutations: MutationLike[]) => {
  const status = useMemo(() => {
    const isAnyPending = mutations.some(m => m.isPending);
    const isAnyError = mutations.some(m => m.isError);
    const isAnySuccess = mutations.some(m => m.isSuccess);
    const hasErrors = mutations.filter(m => m.isError);
    const hasSuccess = mutations.filter(m => m.isSuccess);

    return {
      // Loading states
      isAnyPending,
      isAllPending: mutations.length > 0 && mutations.every(m => m.isPending),

      // Error states
      isAnyError,
      hasErrors,
      firstError: hasErrors[0]?.error,
      allErrors: hasErrors.map(m => m.error),

      // Success states
      isAnySuccess,
      hasSuccess,

      // Combined states
      isIdle: !isAnyPending && !isAnyError && !isAnySuccess,
      isComplete: !isAnyPending && (isAnyError || isAnySuccess),

      // Status summary
      status: isAnyPending ? 'pending' :
        isAnyError ? 'error' :
          isAnySuccess ? 'success' : 'idle',
    };
  }, [mutations]);

  return status;
};

/**
 * Hook for individual mutation status
 */
export const useMutationStatus = (mutation: {
  isPending?: boolean;
  isError?: boolean;
  error?: unknown;
  isSuccess?: boolean;
}) => {
  return useMemo(() => {
    const parsedError = isMutationError(mutation.error) ? mutation.error : null;
    const fallbackMessage = mutation.error instanceof Error ? mutation.error.message : undefined;

    return ({
      isLoading: mutation.isPending,
      isError: mutation.isError,
      error: mutation.error,
      isSuccess: mutation.isSuccess,
      isIdle: !mutation.isPending && !mutation.isError && !mutation.isSuccess,

      // Error message extraction
      errorMessage: parsedError?.response?.data?.message ||
        parsedError?.response?.data?.error ||
        (parsedError?.response?.status === 413
          ? 'Payload Too Large: File exceeds maximum allowed size'
          : parsedError?.message) ||
        fallbackMessage ||
        'An error occurred',

      // Status for UI
      status: mutation.isPending ? 'loading' :
        mutation.isError ? 'error' :
          mutation.isSuccess ? 'success' : 'idle',
    });
  }, [mutation]);
};
