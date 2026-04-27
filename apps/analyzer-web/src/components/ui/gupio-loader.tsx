import React from "react";

interface GupioLoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  variant?: "spinner" | "dots" | "bars" | "pulse";
}

export const GupioLoader: React.FC<GupioLoaderProps> = ({ 
  size = "md", 
  text = "Loading...",
  variant = "spinner"
}) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16"
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg"
  };

  const renderLoader = () => {
    switch (variant) {
      case "dots":
        return (
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        );
      
      case "bars":
        return (
          <div className="flex space-x-1">
            <div className="w-1 h-4 bg-primary rounded-full animate-pulse"></div>
            <div className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
          </div>
        );
      
      case "pulse":
        return (
          <div className={`${sizeClasses[size]} bg-primary rounded-full animate-pulse`}></div>
        );
      
      default: // spinner
        return (
          <div className={`${sizeClasses[size]} relative`}>
            <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
            
            {/* Gupio Logo in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3/4 h-3/4 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">G</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      {renderLoader()}
      
      {/* Loading Text */}
      <div className="text-primary font-medium text-center">
        <span className={`${textSizes[size]}`}>{text}</span>
      </div>
    </div>
  );
};

// Full screen overlay loader
export const GupioOverlayLoader: React.FC<{ text?: string; variant?: "spinner" | "dots" | "bars" | "pulse" }> = ({ 
  text = "Loading Gupio...",
  variant = "spinner"
}) => {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border">
        <GupioLoader size="lg" text={text} variant={variant} />
      </div>
    </div>
  );
};

// Inline loader for small spaces
export const GupioInlineLoader: React.FC<{ size?: "sm" | "md" }> = ({ size = "sm" }) => {
  return (
    <div className="flex items-center space-x-2">
      <div className={`${size === "sm" ? "w-4 h-4" : "w-5 h-5"} border-2 border-muted border-t-primary rounded-full animate-spin`}></div>
      <span className="text-sm text-muted-foreground">Loading...</span>
    </div>
  );
}; 