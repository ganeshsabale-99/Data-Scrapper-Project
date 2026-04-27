import { SegmentTabs } from "./SegmentTabs";
import { FilterControls } from "./FilterControls";
import type { Segment } from "./types";

interface DashboardControlsProps {
  segment: Segment;
  onSegmentChange: (segment: Segment) => void;
  isLoading: boolean;
}

export function DashboardControls({
  segment,
  onSegmentChange,
  isLoading,
}: DashboardControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SegmentTabs
          segment={segment}
          onSegmentChange={onSegmentChange}
          isLoading={isLoading}
        />
        <FilterControls />
      </div>
    </div>
  );
} 