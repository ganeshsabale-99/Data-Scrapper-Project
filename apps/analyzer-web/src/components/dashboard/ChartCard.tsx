import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartContainer } from "@/components/charts/chart-containers";
import { LoadingSpinner } from "./LoadingSpinner";
import type { ChartDistribution } from "./types";

interface ChartCardProps {
  distribution: ChartDistribution;
  isLoading?: boolean;
  onBarClick?: (label: string) => void;
  title?: string;
}

export function ChartCard({ distribution, isLoading = false, onBarClick, title }: ChartCardProps) {
  return (
    <Card>
      <CardHeader>
        {title && <h3 className="text-base font-medium">{title}</h3>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner message="Loading chart data..." size="md" />
        ) : distribution.labels.length > 0 ? (
          <ChartContainer 
            data={{}} 
            distribution={distribution} 
            onBarClick={onBarClick}
          />
        ) : (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-muted-foreground">No data available</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 