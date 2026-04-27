import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './tooltip';

interface SmartTooltipProps {
  children: React.ReactNode;
  content: string;
  maxWidth?: number;
  className?: string;
}

export function SmartTooltip({ children, content, maxWidth = 300, className = '' }: SmartTooltipProps) {
  // Only show tooltip if content is longer than the trigger element
  // const shouldShowTooltip = (triggerElement: HTMLElement) => {
  //   if (!triggerElement) return false;
    
  //   const triggerWidth = triggerElement.offsetWidth;
  //   const triggerScrollWidth = triggerElement.scrollWidth;
    
  //   // Show tooltip if content is truncated or if it's a long text
  //   return triggerScrollWidth > triggerWidth || content.length > 50;
  // };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={className}>
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent 
        className="break-words whitespace-normal text-sm leading-relaxed"
        style={{ maxWidth: `${maxWidth}px` }}
        side="top"
        align="start"
      >
        <div className="max-w-full">
          {content}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Specialized tooltip components for different content types
export function AddressTooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <SmartTooltip content={content} maxWidth={400} className="w-full">
      {children}
    </SmartTooltip>
  );
}

export function WebsiteTooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <SmartTooltip content={content} maxWidth={350} className="w-full">
      {children}
    </SmartTooltip>
  );
}

export function PhoneTooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <SmartTooltip content={content} maxWidth={200} className="w-full">
      {children}
    </SmartTooltip>
  );
}

export function HoursTooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <SmartTooltip content={content} maxWidth={300} className="w-full">
      {children}
    </SmartTooltip>
  );
} 