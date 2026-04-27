import type { NextFunction, Request, Response } from "express";

const normalizeScope = (value: string) => value.trim().toLowerCase();

const hasScope = (grantedScopes: string[], requiredScope: string): boolean => {
  const required = normalizeScope(requiredScope);
  const granted = grantedScopes.map(normalizeScope);

  if (granted.includes(required)) return true;
  if (granted.includes("*")) return true;

  return granted.some((scope) => {
    if (!scope.endsWith("*")) return false;
    const prefix = scope.slice(0, -1);
    return required.startsWith(prefix);
  });
};

export const requireExternalApiScope = (requiredScope: string) => (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const grantedScopes = req.externalApiAuth?.scopes || [];
  if (!hasScope(grantedScopes, requiredScope)) {
    return res.status(403).json({
      success: false,
      code: "FORBIDDEN",
      message: "Forbidden",
    });
  }
  return next();
};
