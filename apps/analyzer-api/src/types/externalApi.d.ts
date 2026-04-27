export type ExternalApiAuthContext = {
  apiKeyId: string;
  keyId: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  rateLimitPerMinute: number;
};

declare global {
  namespace Express {
    interface Request {
      externalApiAuth?: ExternalApiAuthContext;
    }
  }
}

export {};
