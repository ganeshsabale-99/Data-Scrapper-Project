import { SegmentTabs } from "./SegmentTabs";
import { FilterControls } from "./FilterControls";
import type { Segment } from "./types";

interface DashboardControlsProps {
  segment: Segment;
  onSegmentChange: (segment: Segment) => void;
  isLoading: boolean;
  selectedState: string;
  onStateChange: (state: string) => void;
}

export function DashboardControls({
  segment,
  onSegmentChange,
  isLoading,
  selectedState,
  onStateChange,
}: DashboardControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SegmentTabs
          segment={segment}
          onSegmentChange={onSegmentChange}
          isLoading={isLoading}
        />
        <FilterControls 
          selectedState={selectedState}
          onStateChange={onStateChange}
        />
      </div>
    </div>
  );
} 