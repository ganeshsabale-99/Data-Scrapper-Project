import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIA_STATES_AND_UTS } from "./constants";

interface FilterControlsProps {
  selectedState: string;
  onStateChange: (state: string) => void;
}

export function FilterControls({ selectedState, onStateChange }: FilterControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Filter by State:</span>
        <Select value={selectedState} onValueChange={onStateChange}>
          <SelectTrigger className="w-[200px] h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <SelectValue placeholder="Select State" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="ALL">All States</SelectItem>
            {INDIA_STATES_AND_UTS.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
