import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeUiErrorMessage } from "@/lib/error-utils";

type AppRuntimeErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

type AppRuntimeErrorBoundaryProps = {
  children: React.ReactNode;
};

export class AppRuntimeErrorBoundary extends React.Component<
  AppRuntimeErrorBoundaryProps,
  AppRuntimeErrorBoundaryState
> {
  state: AppRuntimeErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown): AppRuntimeErrorBoundaryState {
    return {
      hasError: true,
      message: sanitizeUiErrorMessage(
        error instanceof Error ? error.message : error,
        "An unexpected application error occurred. Please refresh and try again.",
      ),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Runtime application error:", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">
              Oops! Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">{this.state.message}</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
              <Button onClick={() => window.location.reload()}>Reload App</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
