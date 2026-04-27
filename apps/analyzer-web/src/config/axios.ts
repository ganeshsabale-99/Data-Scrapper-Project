import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getAuthToken, clearAuthToken } from "@/lib/token";
import { apiCallLogger } from "@/utils/api-call-logger";
import {
  DB_UNAVAILABLE_MESSAGE,
  GENERIC_SERVER_ERROR_MESSAGE,
  looksLikeDbUnavailableError,
  looksLikeInternalErrorMessage,
} from "@/lib/error-utils";

// Request deduplication cache
const pendingRequests = new Map<string, Promise<InternalAxiosRequestConfig>>();
const globalLoaderRequestIdSymbol = Symbol("globalLoaderRequestId");

type LoaderAwareRequestConfig = InternalAxiosRequestConfig & {
  showGlobalLoader?: boolean;
  [globalLoaderRequestIdSymbol]?: number;
};

export type GlobalApiLoaderState = {
  isLoading: boolean;
  pendingCount: number;
};

type GlobalApiLoaderListener = (state: GlobalApiLoaderState) => void;

const globalApiLoaderListeners = new Set<GlobalApiLoaderListener>();
const activeGlobalLoaderRequestIds = new Set<number>();
let globalLoaderRequestSequence = 0;

const notifyGlobalApiLoaderListeners = () => {
  const state: GlobalApiLoaderState = {
    isLoading: activeGlobalLoaderRequestIds.size > 0,
    pendingCount: activeGlobalLoaderRequestIds.size,
  };
  globalApiLoaderListeners.forEach((listener) => listener(state));
};

const shouldTrackGlobalLoader = (config: LoaderAwareRequestConfig): boolean => {
  if (typeof config.showGlobalLoader === "boolean") {
    return config.showGlobalLoader;
  }

  const method = (config.method ?? "get").toLowerCase();
  const isWriteRequest = ["post", "put", "patch", "delete"].includes(method);
  const isDownloadRequest =
    config.responseType === "blob" || config.responseType === "arraybuffer";

  return isWriteRequest || isDownloadRequest;
};

const startGlobalLoader = (config: LoaderAwareRequestConfig) => {
  if (!shouldTrackGlobalLoader(config)) return;
  const requestId = ++globalLoaderRequestSequence;
  config[globalLoaderRequestIdSymbol] = requestId;
  activeGlobalLoaderRequestIds.add(requestId);
  notifyGlobalApiLoaderListeners();
};

const stopGlobalLoader = (
  config?: InternalAxiosRequestConfig | LoaderAwareRequestConfig,
) => {
  const loaderAwareConfig = config as LoaderAwareRequestConfig | undefined;
  const requestId = loaderAwareConfig?.[globalLoaderRequestIdSymbol];
  if (typeof requestId !== "number") return;
  if (!activeGlobalLoaderRequestIds.delete(requestId)) return;
  notifyGlobalApiLoaderListeners();
};

export const subscribeToGlobalApiLoader = (
  listener: GlobalApiLoaderListener,
) => {
  globalApiLoaderListeners.add(listener);
  listener({
    isLoading: activeGlobalLoaderRequestIds.size > 0,
    pendingCount: activeGlobalLoaderRequestIds.size,
  });
  return () => {
    globalApiLoaderListeners.delete(listener);
  };
};

const sanitizeErrorResponse = (error: unknown) => {
  const axiosError = error as AxiosError<Record<string, unknown>> & { message?: string };
  const responseStatus = axiosError.response?.status;
  const responseData =
    axiosError.response?.data && typeof axiosError.response.data === "object"
      ? (axiosError.response.data as Record<string, unknown>)
      : null;

  const messageFromResponse =
    typeof responseData?.message === "string"
      ? responseData.message
      : typeof responseData?.error === "string"
        ? responseData.error
        : "";
  const fallbackMessage = typeof axiosError.message === "string" ? axiosError.message : "";
  const combinedMessage = `${messageFromResponse} ${fallbackMessage}`.trim();

  if (looksLikeDbUnavailableError(combinedMessage)) {
    if (responseData) {
      axiosError.response!.data = {
        ...responseData,
        code: "DB_UNAVAILABLE",
        message: DB_UNAVAILABLE_MESSAGE,
        error: DB_UNAVAILABLE_MESSAGE,
      };
    }
    axiosError.message = DB_UNAVAILABLE_MESSAGE;
    return;
  }

  if (
    typeof responseStatus === "number" &&
    responseStatus >= 500 &&
    (looksLikeInternalErrorMessage(combinedMessage) || !messageFromResponse)
  ) {
    if (responseData) {
      axiosError.response!.data = {
        ...responseData,
        code:
          typeof responseData.code === "string"
            ? responseData.code
            : "INTERNAL_SERVER_ERROR",
        message: GENERIC_SERVER_ERROR_MESSAGE,
        error: GENERIC_SERVER_ERROR_MESSAGE,
      };
    }
    axiosError.message = GENERIC_SERVER_ERROR_MESSAGE;
  }
};

const safeGetAuthToken = (): string | null => {
  try {
    return getAuthToken();
  } catch {
    return null;
  }
};

const safeClearAuthToken = (): void => {
  try {
    clearAuthToken();
  } catch {
    // Ignore storage errors during forced logout.
  }
};

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
});

// Request deduplication interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Create a unique key for this request
    const requestKey = `${config.method?.toUpperCase()}_${config.url}_${JSON.stringify(config.params || {})}_${JSON.stringify(config.data || {})}`;

    // If the same request is already pending, return the existing promise
    if (pendingRequests.has(requestKey)) {
      return pendingRequests.get(requestKey)!;
    }

    // Create a new promise for this request
    const requestPromise = Promise.resolve(config).then((resolvedConfig) => {
      // Log the API call
      apiCallLogger.log(
        resolvedConfig.method?.toUpperCase() || "GET",
        resolvedConfig.url || "",
        resolvedConfig.params,
        resolvedConfig.data,
      );

      // Attach Authorization header if token exists
      const token = safeGetAuthToken();
      if (token) {
        resolvedConfig.headers = resolvedConfig.headers ?? {};
        (resolvedConfig.headers as Record<string, string>)["Authorization"] =
          `Bearer ${token}`;
      }

      startGlobalLoader(resolvedConfig as LoaderAwareRequestConfig);
      return resolvedConfig;
    });

    // Store the promise in the cache
    pendingRequests.set(requestKey, requestPromise);

    // Remove from cache when request completes (success or error)
    requestPromise.finally(() => {
      pendingRequests.delete(requestKey);
    });

    return requestPromise;
  },
  (error: unknown) => {
    const axiosError = error as AxiosError;
    stopGlobalLoader(axiosError.config);
    return Promise.reject(axiosError);
  },
);

// Handle 401 responses globally
axiosInstance.interceptors.response.use(
  (response) => {
    stopGlobalLoader(response.config);
    return response;
  },
  (error: unknown) => {
    const axiosError = error as AxiosError<{ code?: string }>;
    stopGlobalLoader(axiosError.config);
    sanitizeErrorResponse(error);

    const status = axiosError.response?.status;
    const code = axiosError.response?.data?.code;
    if (status === 401 && code && ["TOKEN_MISSING", "TOKEN_INVALID", "TOKEN_EXPIRED"].includes(code)) {
      safeClearAuthToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(axiosError);
  }
);
