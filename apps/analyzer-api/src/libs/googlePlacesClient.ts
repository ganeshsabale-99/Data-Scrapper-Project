import axios from "axios";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Google Places `status` values that mean "retrying won't help" — a bad key,
// a malformed request, or a genuinely empty result. Everything else (a transient
// network blip, a 5xx, or OVER_QUERY_LIMIT) is worth retrying with backoff.
const NON_RETRYABLE_STATUSES = new Set(["REQUEST_DENIED", "INVALID_REQUEST"]);

export class GooglePlacesRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: string,
  ) {
    super(message);
    this.name = "GooglePlacesRequestError";
  }
}

interface FetchOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

// Fetches a Google Places endpoint (Text Search / Place Details) with exponential
// backoff + jitter on transient failures. Throws GooglePlacesRequestError (marked
// non-retryable when the failure is permanent, e.g. a rejected API key) so callers
// can distinguish "give up on this one place" from "give up on the whole scrape".
export async function fetchGooglePlaces(
  url: string,
  params: Record<string, string>,
  options: FetchOptions = {},
): Promise<any> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, { params, timeout: 15000 });
      const status = response.data?.status;

      if (!status || status === "OK" || status === "ZERO_RESULTS") {
        return response.data;
      }

      if (NON_RETRYABLE_STATUSES.has(status)) {
        throw new GooglePlacesRequestError(
          response.data?.error_message || `Google Places returned ${status}`,
          status,
        );
      }

      // OVER_QUERY_LIMIT and anything else unrecognized: worth a retry.
      lastError = new GooglePlacesRequestError(
        response.data?.error_message || `Google Places returned ${status}`,
        status,
      );
    } catch (error) {
      if (error instanceof GooglePlacesRequestError && NON_RETRYABLE_STATUSES.has(error.status || "")) {
        throw error;
      }
      lastError = error;
    }

    if (attempt < maxRetries) {
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 250;
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
