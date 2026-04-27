export const DB_UNAVAILABLE_MESSAGE =
  "Database is temporarily unavailable. Please try again in a few minutes.";

export const GENERIC_SERVER_ERROR_MESSAGE =
  "Unable to process your request right now. Please try again.";

const DB_ERROR_PATTERNS = [
  /can't reach database server/i,
  /database.*temporarily unavailable/i,
  /connection.+refused/i,
  /connection.+timed out/i,
  /econnrefused/i,
  /etimedout/i,
  /server has closed the connection/i,
  /db_unavailable/i,
];

const INTERNAL_ERROR_PATTERNS = [
  /invalid `.*` invocation/i,
  /prisma client request/i,
  /prismainstance\./i,
  /at .*\/node_modules\//i,
  /stack trace/i,
];

export const looksLikeDbUnavailableError = (message: string): boolean =>
  DB_ERROR_PATTERNS.some((pattern) => pattern.test(message));

export const looksLikeInternalErrorMessage = (message: string): boolean =>
  INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));

export const sanitizeUiErrorMessage = (
  rawMessage: unknown,
  fallback = GENERIC_SERVER_ERROR_MESSAGE,
): string => {
  const message =
    typeof rawMessage === "string"
      ? rawMessage.trim()
      : rawMessage instanceof Error
        ? rawMessage.message.trim()
        : "";

  if (!message) return fallback;
  if (looksLikeDbUnavailableError(message)) return DB_UNAVAILABLE_MESSAGE;
  if (looksLikeInternalErrorMessage(message)) return fallback;
  return message;
};
