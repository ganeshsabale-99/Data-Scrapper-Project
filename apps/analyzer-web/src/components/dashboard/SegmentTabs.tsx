import type { Segment } from "./types";
import { TAB_ITEMS } from "./constants";

interface SegmentTabsProps {
  segment: Segment;
  onSegmentChange: (segment: Segment) => void;
  isLoading?: boolean;
}

export function SegmentTabs({ segment, onSegmentChange, isLoading = false }: SegmentTabsProps) {
  return (
    <div role="tablist" aria-label="Segments" className="flex items-center gap-2 p-1 bg-white rounded-md border">
      {TAB_ITEMS.map((tab) => {
        const isDisabled = isLoading;

        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={segment === tab.key}
            disabled={isDisabled}
            className={`px-4 py-2 text-sm transition-colors font-medium rounded-md border ${isDisabled
                ? "text-muted-foreground cursor-not-allowed opacity-50"
                : segment === tab.key
                  ? "text-indigo-700 bg-indigo-50 border-indigo-300 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-indigo-50 border-transparent"
              }`}
            onClick={() => !isDisabled && onSegmentChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
} 