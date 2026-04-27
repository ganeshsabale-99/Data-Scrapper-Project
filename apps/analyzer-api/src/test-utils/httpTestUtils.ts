import type { NextFunction, Request, Response } from "express";

type MockRequestOptions = {
  method?: string;
  originalUrl?: string;
  path?: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  body?: unknown;
  ip?: string;
  user?: Request["user"];
  requestId?: string;
};

type MockResponse = Response & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
};

const lowerCaseHeaders = (headers: Record<string, string> = {}) => {
  const normalized: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
};

export const createMockRequest = (options: MockRequestOptions = {}): Request => {
  const headers = lowerCaseHeaders(options.headers);

  const req = {
    method: options.method || "GET",
    originalUrl: options.originalUrl || "/",
    path: options.path || options.originalUrl || "/",
    headers,
    query: options.query || {},
    params: options.params || {},
    body: options.body,
    ip: options.ip || "127.0.0.1",
    user: options.user,
    requestId: options.requestId || "req-test-001",
    get: (name: string) => headers[name.toLowerCase()],
    header: (name: string) => headers[name.toLowerCase()],
  } as Request;

  return req;
};

export const createMockResponse = (req?: Request): MockResponse => {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: undefined,
    headers,
    req,
    locals: {},
    status: (code: number) => {
      res.statusCode = code;
      return res as unknown as Response;
    },
    json: (payload: unknown) => {
      res.body = payload;
      return res as unknown as Response;
    },
    setHeader: (name: string, value: string | number | readonly string[]) => {
      if (Array.isArray(value)) {
        headers[name.toLowerCase()] = value.join(", ");
      } else {
        headers[name.toLowerCase()] = String(value);
      }
      return res as unknown as Response;
    },
    getHeader: (name: string) => {
      return headers[name.toLowerCase()];
    },
  } as unknown as MockResponse;

  return res;
};

export const createNextSpy = () => {
  let called = false;
  let capturedError: unknown;

  const next: NextFunction = (error?: unknown) => {
    called = true;
    capturedError = error;
  };

  return {
    next,
    wasCalled: () => called,
    error: () => capturedError,
  };
};
