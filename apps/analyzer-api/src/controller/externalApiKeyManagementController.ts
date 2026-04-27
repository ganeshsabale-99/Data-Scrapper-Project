import type { Request, Response } from "express";
import { prismaInstance } from "@repo/db";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { generateExternalApiKeySecret, hashExternalApiKey } from "../utils/externalApiKeyUtils";
import crypto from "node:crypto";

export const listExternalClients = async (req: Request, res: Response) => {
    try {
        const clients = await prismaInstance.externalApiClient.findMany({
            include: {
                keys: {
                    select: {
                        id: true,
                        keyId: true,
                        keyPrefix: true,
                        isActive: true,
                        rateLimitPerMinute: true,
                        expiresAt: true,
                        lastUsedAt: true,
                        revokedAt: true,
                        createdAt: true,
                    },
                },
                scopes: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return res.json({
            success: true,
            data: clients,
        });
    } catch (error) {
        return sendSafeErrorResponse(res, error, "admin.external.listClients");
    }
};

export const createExternalClient = async (req: Request, res: Response) => {
    try {
        const { name } = req.body as {
            name: string;
        };

        if (!name) {
            return res.status(400).json({ success: false, message: "Client name is required" });
        }

        const client = await prismaInstance.externalApiClient.create({
            data: {
                name,
                isActive: true,
            },
        });

        return res.status(201).json({
            success: true,
            data: client,
        });
    } catch (error) {
        return sendSafeErrorResponse(res, error, "admin.external.createClient");
    }
};

export const issueExternalApiKey = async (req: Request, res: Response) => {
    try {
        const { clientId, name, rateLimitPerMinute, expiresAt, scopes } = req.body as {
            clientId: string;
            name: string;
            rateLimitPerMinute?: number;
            expiresAt?: string;
            scopes?: string[];
        };

        if (!clientId) {
            return res.status(400).json({ success: false, message: "clientId is required" });
        }

        const client = await prismaInstance.externalApiClient.findUnique({
            where: { id: clientId },
            include: { scopes: true },
        });

        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found" });
        }

        // Handle dynamic scopes if provided
        if (scopes && scopes.length > 0) {
            for (const scopeKey of scopes) {
                const existingScope = client.scopes.find(s => s.scope === scopeKey);
                if (!existingScope) {
                    await prismaInstance.externalApiScope.create({
                        data: {
                            clientId,
                            scope: scopeKey,
                        },
                    });
                }
            }
        }

        const secret = await generateExternalApiKeySecret();
        const keyId = crypto.randomBytes(8).toString("hex");
        const pepper = process.env.EXTERNAL_API_KEY_PEPPER;

        if (!pepper) {
            throw new Error("EXTERNAL_API_KEY_PEPPER is not configured on server");
        }

        const keyHash = hashExternalApiKey(keyId, secret, pepper);
        const fullKey = `tpk_${keyId}.${secret}`;

        const apiKey = await prismaInstance.externalApiKey.create({
            data: {
                keyId,
                clientId,
                keyPrefix: `tpk_${keyId}`,
                keyHash,
                rateLimitPerMinute: rateLimitPerMinute || 120,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                isActive: true,
            },
        });

        return res.status(201).json({
            success: true,
            data: {
                ...apiKey,
                name,
                rawKey: fullKey,
            },
        });
    } catch (error) {
        return sendSafeErrorResponse(res, error, "admin.external.issueKey");
    }
};

export const revokeExternalApiKey = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (typeof id !== "string") {
            return res.status(400).json({ success: false, message: "Valid API key ID is required" });
        }

        await prismaInstance.externalApiKey.update({
            where: { id },
            data: {
                isActive: false,
                revokedAt: new Date(),
            },
        });

        return res.json({ success: true, message: "API key revoked successfully" });
    } catch (error) {
        return sendSafeErrorResponse(res, error, "admin.external.revokeKey");
    }
};

export const deleteExternalClient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (typeof id !== "string") {
            return res.status(400).json({ success: false, message: "Valid Client ID is required" });
        }

        await prismaInstance.$transaction([
            prismaInstance.externalApiKey.deleteMany({ where: { clientId: id } }),
            prismaInstance.externalApiScope.deleteMany({ where: { clientId: id } }),
            prismaInstance.externalApiClient.delete({ where: { id } }),
        ]);

        return res.json({ success: true, message: "Client deleted successfully" });
    } catch (error) {
        return sendSafeErrorResponse(res, error, "admin.external.deleteClient");
    }
};
