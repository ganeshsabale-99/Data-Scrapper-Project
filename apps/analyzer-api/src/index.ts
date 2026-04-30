import { app } from "./app";
import http from "http";
import {
    logOperationalEvent,
    runStartupHealthChecks,
    startHealthHeartbeatLogger,
} from "./libs/serviceHealthLogger";
import { warmupRateLimitStore, closeRateLimitStore } from "./middleware/security";
import { parseBooleanEnv } from "./utils/envUtils"; // I'll check if this exists or move it
import { startNewsScheduler } from "./libs/newsScheduler";
import { ensureRbacBootstrap } from "./modules/rbac/accessControlService";
import { startTechParkCompanySyncScheduler } from "./libs/techParkCompanySync";

const configuredPort = Number.parseInt(process.env.PORT || "8080", 10);
const PORT = Number.isFinite(configuredPort) ? configuredPort : 8080;
let stopHealthHeartbeatLogger: (() => void) | null = null;

const server = http.createServer(app);

let activeConnections = 0;
server.on("connection", (socket) => {
    activeConnections++;
    socket.on("close", () => {
        activeConnections--;
    });
});

server.listen(PORT, () => {
    logOperationalEvent("server.listening", {
        port: PORT,
        localUrl: `http://localhost:${PORT}`,
        environment: process.env.NODE_ENV || "development",
        pid: process.pid,
    });

    stopHealthHeartbeatLogger = startHealthHeartbeatLogger();
    void warmupRateLimitStore()
        .then((storeName) => {
            logOperationalEvent("rate_limit.store.ready", {
                store: storeName,
                mode: process.env.API_RATE_LIMIT_STORE || "auto",
            });
        })
        .catch((error) => {
            logOperationalEvent(
                "rate_limit.store.failed",
                {
                    error: error instanceof Error ? error.message : String(error),
                },
                "warn",
            );
        });

    void (async () => {
        const startupSnapshot = await runStartupHealthChecks();

        // Side logic helper
        const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
            if (!value) return defaultValue;
            const normalized = value.trim().toLowerCase();
            if (["1", "true", "yes", "on"].includes(normalized)) return true;
            if (["0", "false", "no", "off"].includes(normalized)) return false;
            return defaultValue;
        };

        const schedulerEnabled = parseBoolean(process.env.NEWS_SCHEDULER_ENABLED, true);

        if (!schedulerEnabled) {
            logOperationalEvent("news.scheduler.disabled", {
                reason: "NEWS_SCHEDULER_ENABLED=false",
            });
            return;
        }

        if (startupSnapshot.services.database.status !== "healthy") {
            logOperationalEvent(
                "news.scheduler.skipped",
                {
                    reason: "database_unhealthy_at_startup",
                    databaseStatus: startupSnapshot.services.database.status,
                },
                "warn",
            );
            return;
        }

        try {
            await ensureRbacBootstrap();
            logOperationalEvent("rbac.bootstrap.completed", {
                mode: process.env.NODE_ENV,
            });
        } catch (error) {
            logOperationalEvent("rbac.bootstrap.failed_startup", {
                error: error instanceof Error ? error.message : String(error),
            }, "error");
        }

        try {
            startNewsScheduler();
            logOperationalEvent("news.scheduler.started", {
                timezone: "Asia/Kolkata",
                cronExpression: "0 */2 9-18 * * *",
            });
        } catch (error: unknown) {
            logOperationalEvent(
                "news.scheduler.failed_to_start",
                {
                    error: error instanceof Error ? error.message : String(error),
                },
                "error",
            );
        }

        try {
            startTechParkCompanySyncScheduler();
        } catch (error: unknown) {
            logOperationalEvent(
                "techpark.company_sync.failed_to_start",
                {
                    error: error instanceof Error ? error.message : String(error),
                },
                "error",
            );
        }
    })();
});

const gracefulShutdown = (signal: string) => {
    logOperationalEvent("server.shutdown.initiated", {
        signal,
        activeConnections,
    });

    if (stopHealthHeartbeatLogger) {
        stopHealthHeartbeatLogger();
        stopHealthHeartbeatLogger = null;
    }

    void closeRateLimitStore().catch((error) => {
        logOperationalEvent(
            "rate_limit.store.shutdown_failed",
            {
                signal,
                error: error instanceof Error ? error.message : String(error),
            },
            "warn",
        );
    });

    server.close((error) => {
        if (error) {
            logOperationalEvent(
                "server.shutdown.error",
                {
                    signal,
                    error: error.message,
                },
                "error",
            );
            process.exit(1);
        }
        logOperationalEvent("server.shutdown.closed", {
            signal,
            activeConnections,
        });

        if (activeConnections === 0) {
            logOperationalEvent("server.shutdown.completed", {
                signal,
                forced: false,
            });
            process.exit(0);
        } else {
            logOperationalEvent("server.shutdown.waiting_for_connections", {
                signal,
                activeConnections,
            });
        }
    });

    setTimeout(() => {
        logOperationalEvent(
            "server.shutdown.force_exit",
            {
                signal,
                timeoutMs: 10000,
                activeConnections,
            },
            "error",
        );
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
    logOperationalEvent(
        "server.uncaught_exception",
        {
            error: err?.message || String(err),
            stack: err?.stack,
        },
        "error",
    );
    gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
    logOperationalEvent(
        "server.unhandled_rejection",
        {
            reason: reason instanceof Error ? reason.message : String(reason),
            promise: String(promise),
        },
        "error",
    );
    gracefulShutdown("unhandledRejection");
});

server.on("error", (err) => {
    logOperationalEvent(
        "server.error",
        {
            error: err?.message || String(err),
            stack: err?.stack,
        },
        "error",
    );
    gracefulShutdown("serverError");
});
