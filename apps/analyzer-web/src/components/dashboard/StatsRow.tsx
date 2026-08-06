import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users } from "lucide-react";
import { getSegmentLabel } from "./constants";
import type { DashboardStats, Segment } from "./types";

interface StatsRowProps {
  stats?: DashboardStats;
  segment: Segment;
  isLoading?: boolean;
}

export function StatsRow({ stats, segment, isLoading = false }: StatsRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const segmentLabel = getSegmentLabel(segment);
  const totalLabel = `Total ${segmentLabel}`;
  const contactedLabel = `Contacted ${segmentLabel}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      <Card>
        <CardContent className="p-4 flex items-start justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{totalLabel}</div>
            <div className="text-2xl font-bold mt-2">{stats.total}</div>
          </div>
          <div className="p-2 rounded-md bg-blue-100 text-blue-600">
            <Building2 className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex items-start justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{contactedLabel}</div>
            <div className="text-2xl font-bold mt-2">{stats.contacted}</div>
          </div>
          <div className="p-2 rounded-md bg-green-100 text-green-600">
            <Users className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 