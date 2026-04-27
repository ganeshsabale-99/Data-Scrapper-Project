
import { isRouteErrorResponse, useRouteError } from "react-router";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sanitizeUiErrorMessage } from "@/lib/error-utils";

export function ErrorBoundary() {
  const error = useRouteError();
  
  console.error('Route error:', error);

  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const statusLine =
    isRouteErrorResponse(error) && error.status
      ? `Error ${error.status}${error.statusText ? `: ${error.statusText}` : ""}`
      : null;

  const message = (() => {
    if (is404) return "The page you're looking for doesn't exist.";

    if (isRouteErrorResponse(error)) {
      const responseMessage =
        typeof error.data === "object" && error.data !== null
          ? (error.data as { message?: unknown; error?: unknown }).message ??
            (error.data as { error?: unknown }).error
          : null;

      return sanitizeUiErrorMessage(
        responseMessage,
        "An unexpected error occurred. Please try again.",
      );
    }

    if (error instanceof Error) {
      return sanitizeUiErrorMessage(
        error.message,
        "An unexpected error occurred. Please try again.",
      );
    }

    return "An unexpected error occurred. Please try again.";
  })();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-red-600">
            Oops! Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              {message}
            </p>
            {statusLine && (
              <p className="text-sm text-muted-foreground">
                {statusLine}
              </p>
            )}
          </div>
          <div className="flex justify-center space-x-2">
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
            <Button 
              onClick={() => window.location.href = '/'}
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
