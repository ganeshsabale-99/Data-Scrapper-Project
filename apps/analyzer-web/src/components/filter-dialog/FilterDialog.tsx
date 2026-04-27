import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface FilterState {
  status: string;
  business_status: string;
  minRating: string;
  maxRating: string;
  searchQuery: string;
}

interface Props {
  open: boolean;
  filters: FilterState;
  onOpenChange: (val: boolean) => void;
  activeFilterCount: number;
  handleFilterChange: (key: keyof FilterState, value: string) => void;
  resetFilters: () => void;
  onApply: () => void;
}

export const FilterDialog = ({
  open,
  onOpenChange,
  filters,
  activeFilterCount,
  handleFilterChange,
  resetFilters,
  onApply,
}: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Filter Locations</DialogTitle>
          <DialogDescription>
            Apply filters to narrow down your search results.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              placeholder="Search by name, address or phone"
              value={filters.searchQuery}
              onChange={(e) =>
                handleFilterChange("searchQuery", e.target.value)
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="Not Contacted">Not Contacted</SelectItem>
                  <SelectItem value="Contacted">Contacted</SelectItem>
                  <SelectItem value="In Discussion">In Discussion</SelectItem>
                  <SelectItem value="Converted">Converted</SelectItem>
                  <SelectItem value="Lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Business Status</Label>
              <Select
                value={filters.business_status}
                onValueChange={(value) =>
                  handleFilterChange("business_status", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select business status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Business Statuses</SelectItem>
                  <SelectItem value="OPERATIONAL">Operational</SelectItem>
                  <SelectItem value="CLOSED_TEMPORARILY">
                    Closed Temporarily
                  </SelectItem>
                  <SelectItem value="CLOSED_PERMANENTLY">
                    Closed Permanently
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Minimum Rating</Label>
              <Input
                type="number"
                min="0"
                max="5"
                step="0.1"
                placeholder="0"
                value={filters.minRating}
                onChange={(e) =>
                  handleFilterChange("minRating", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Maximum Rating</Label>
              <Input
                type="number"
                min="0"
                max="5"
                step="0.1"
                placeholder="5"
                value={filters.maxRating}
                onChange={(e) =>
                  handleFilterChange("maxRating", e.target.value)
                }
              />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {Object.entries(filters).map(([key, value]) => {
                if (
                  (key === "status" || key === "business_status") &&
                  value === "ALL"
                )
                  return null;
                if (!value) return null;

                return (
                  <Badge
                    key={key}
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    <span className="text-xs capitalize">
                      {key.replace("_", " ")}: {value}
                    </span>
                    <button
                      onClick={() =>
                        handleFilterChange(
                          key as keyof FilterState,
                          key === "status" || key === "business_status"
                            ? "ALL"
                            : ""
                        )
                      }
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={resetFilters}>
            Reset All
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onApply}>Apply Filters</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
