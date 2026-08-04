import { FilterControls } from "./FilterControls";

interface DashboardControlsProps {
  isLoading: boolean;
  selectedState: string;
  onStateChange: (state: string) => void;
}

export function DashboardControls({
  isLoading: _isLoading,
  selectedState,
  onStateChange,
}: DashboardControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <FilterControls
          selectedState={selectedState}
          onStateChange={onStateChange}
        />
      </div>
    </div>
  );
}
