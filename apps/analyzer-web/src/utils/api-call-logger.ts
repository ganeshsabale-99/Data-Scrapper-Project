/**
 * Utility to log API calls for debugging multiple call issues
 */

interface ApiCallLog {
  timestamp: number;
  method: string;
  url: string;
  params?: unknown;
  data?: unknown;
  stack?: string;
}

class ApiCallLogger {
  private calls: ApiCallLog[] = [];
  private maxLogs = 100;

  log(method: string, url: string, params?: unknown, data?: unknown) {
    const log: ApiCallLog = {
      timestamp: Date.now(),
      method,
      url,
      params,
      data,
      stack: new Error().stack
    };

    this.calls.push(log);

    // Keep only the last maxLogs entries
    if (this.calls.length > this.maxLogs) {
      this.calls = this.calls.slice(-this.maxLogs);
    }

  }

  getDuplicateCalls(): ApiCallLog[][] {
    const duplicates: Record<string, ApiCallLog[]> = {};
    
    this.calls.forEach(call => {
      const key = `${call.method}_${call.url}_${JSON.stringify(call.params)}_${JSON.stringify(call.data)}`;
      if (!duplicates[key]) {
        duplicates[key] = [];
      }
      duplicates[key].push(call);
    });

    return Object.values(duplicates).filter(calls => calls.length > 1);
  }

  getRecentCalls(seconds: number = 5): ApiCallLog[] {
    const cutoff = Date.now() - (seconds * 1000);
    return this.calls.filter(call => call.timestamp > cutoff);
  }

  clear() {
    this.calls = [];
  }

  getStats() {
    const duplicates = this.getDuplicateCalls();
    return {
      totalCalls: this.calls.length,
      duplicateGroups: duplicates.length,
      totalDuplicates: duplicates.reduce((sum, group) => sum + group.length, 0)
    };
  }
}

export const apiCallLogger = new ApiCallLogger();

// Log API calls in development
if (import.meta.env.DEV) {
  // Override console methods to detect duplicate calls
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    const firstArg = args[0];
    if (typeof firstArg === "string" && firstArg.includes("API Call:")) {
      // This is an API call log, we can analyze it
    }
    originalLog.apply(console, args);
  };
}
