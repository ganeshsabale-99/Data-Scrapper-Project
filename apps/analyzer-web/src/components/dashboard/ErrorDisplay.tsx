import { Button } from "@/components/ui/button";
import { sanitizeUiErrorMessage } from "@/lib/error-utils";

interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export function ErrorDisplay({ error, onRetry, showRetry = false }: ErrorDisplayProps) {
  const safeMessage = sanitizeUiErrorMessage(
    error,
    "Unable to load data right now. Please try again.",
  );

  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
      <div className="flex">
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{safeMessage}</p>
          </div>
          {showRetry && onRetry && (
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
