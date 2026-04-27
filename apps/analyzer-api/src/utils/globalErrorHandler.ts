import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { toPublicApiError, withErrorMetadata } from "./safeErrorResponse";

export interface IError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  message: string;
}

export const globalErrorHandler = (
  error: IError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const fallbackMessage =
    "Unable to process your request right now. Please try again.";
  const requestId = req.requestId;
  const safeError = withErrorMetadata(
    toPublicApiError(error, fallbackMessage),
    requestId,
  );
  const errorStatus = safeError.status || StatusCodes.INTERNAL_SERVER_ERROR;
  const errorMessage = error?.message || "Unknown error";

  try {
    console.error("[globalErrorHandler]", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: errorStatus,
      code: safeError.body.code,
      name: error?.name,
      message: errorMessage,
    });
    if (error?.stack) console.error(error.stack);
  } catch {}

  if (res.headersSent) return;
  res.status(errorStatus).json(safeError.body);
};
