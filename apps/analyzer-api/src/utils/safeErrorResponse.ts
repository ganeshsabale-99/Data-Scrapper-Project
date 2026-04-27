import type { Response } from "express";

export type PublicApiError = {
  status: number;
  body: {
    success: false;
    code: string;
    message: string;
    requestId?: string;
    timestamp?: string;
  };
};

const DB_CONNECTIVITY_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "P2037"]);
const PRISMA_CLIENT_ERROR_MAP: Record<
  string,
  { status: number; code: string; message: string }
> = {
  P2002: {
    status: 409,
    code: "DUPLICATE_RESOURCE",
    message: "This record already exists.",
  },
  P2003: {
    status: 400,
    code: "INVALID_REFERENCE",
    message: "The provided reference is invalid.",
  },
  P2025: {
    status: 404,
    code: "NOT_FOUND",
    message: "Requested resource was not found.",
  },
};
const DB_CONNECTIVITY_PATTERNS = [
  /can't reach database server/i,
  /database.*temporarily unavailable/i,
  /connection.+refused/i,
  /connection.+timed out/i,
  /connection.+terminated/i,
  /econnrefused/i,
  /etimedout/i,
  /server has closed the connection/i,
  /timed out fetching a new connection from the connection pool/i,
  /connection pool timeout/i,
];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

const getErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

const toErrorStatus = (statusValue: unknown): number | undefined => {
  if (typeof statusValue !== "number") return undefined;
  if (!Number.isInteger(statusValue)) return undefined;
  if (statusValue < 400 || statusValue > 599) return undefined;
  return statusValue;
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const rawStatus = (error as { status?: unknown; statusCode?: unknown }).status;
  const rawStatusCode = (error as { statusCode?: unknown }).statusCode;
  return toErrorStatus(rawStatus) ?? toErrorStatus(rawStatusCode);
};

export const isDbConnectivityError = (error: unknown): boolean => {
  const code = getErrorCode(error)?.toUpperCase();
  if (code && DB_CONNECTIVITY_CODES.has(code)) return true;

  const message = getErrorMessage(error);
  return DB_CONNECTIVITY_PATTERNS.some((pattern) => pattern.test(message));
};

const getStatusFallbackMessage = (status: number): string => {
  if (status === 400) return "Invalid request payload.";
  if (status === 401) return "Authentication required.";
  if (status === 403) return "You do not have permission for this action.";
  if (status === 404) return "Requested resource was not found.";
  if (status === 409) return "The request conflicts with current resource state.";
  if (status === 422) return "Request validation failed.";
  if (status === 429) return "Too many requests. Please try again in a moment.";
  return "Request failed.";
};

const getStatusDefaultCode = (status: number): string => {
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "UNPROCESSABLE_ENTITY";
  if (status === 429) return "RATE_LIMITED";
  return "REQUEST_FAILED";
};

export const toPublicApiError = (
  error: unknown,
  fallbackMessage: string,
): PublicApiError => {
  const code = getErrorCode(error)?.toUpperCase();

  if (isDbConnectivityError(error)) {
    return {
      status: 503,
      body: {
        success: false,
        code: "DB_UNAVAILABLE",
        message:
          "Database is temporarily unavailable. Please try again in a few minutes.",
      },
    };
  }

  if (code && PRISMA_CLIENT_ERROR_MAP[code]) {
    const mapped = PRISMA_CLIENT_ERROR_MAP[code];
    return {
      status: mapped.status,
      body: {
        success: false,
        code: mapped.code,
        message: mapped.message,
      },
    };
  }

  const errorStatus = getErrorStatus(error);
  if (errorStatus && errorStatus >= 400 && errorStatus < 500) {
    const errorMessage = getErrorMessage(error)?.trim();
    return {
      status: errorStatus,
      body: {
        success: false,
        code: code || getStatusDefaultCode(errorStatus),
        message: errorMessage || getStatusFallbackMessage(errorStatus),
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: fallbackMessage,
    },
  };
};

export const withErrorMetadata = (
  safeError: PublicApiError,
  requestId?: string,
): PublicApiError => ({
  ...safeError,
  body: {
    ...safeError.body,
    ...(requestId ? { requestId } : {}),
    timestamp: safeError.body.timestamp || new Date().toISOString(),
  },
});

export const sendSafeErrorResponse = (
  res: Response,
  error: unknown,
  context: string,
  fallbackMessage = "Something went wrong. Please try again.",
) => {
  const requestId =
    res.req &&
    typeof (res.req as { requestId?: unknown }).requestId === "string"
      ? ((res.req as { requestId: string }).requestId ?? undefined)
      : undefined;
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  const name = error instanceof Error ? error.name : "UnknownError";
  const status = getErrorStatus(error);

  console.error(`[${context}]`, { requestId, name, status, code, message });
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }

  const safeError = withErrorMetadata(toPublicApiError(error, fallbackMessage), requestId);
  return res.status(safeError.status).json(safeError.body);
};
