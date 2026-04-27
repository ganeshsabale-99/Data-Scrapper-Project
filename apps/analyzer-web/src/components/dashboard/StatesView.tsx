import { StatsRow } from "./StatsRow";
import { ChartCard } from "./ChartCard";
import { StatesTable } from "./StatesTable";
import type { DashboardStats, ChartDistribution, StateRow, Segment } from "./types";

interface StatesViewProps {
  overallStats?: DashboardStats;
  statesDistribution: ChartDistribution;
  stateRows: StateRow[];
  segment: Segment;
  isLoading: boolean;
  onStateClick: (state: string) => void;
}

export function StatesView({
  overallStats,
  statesDistribution,
  stateRows,
  segment,
  isLoading,
  onStateClick,
}: StatesViewProps) {
  return (
    <>
      <StatsRow stats={overallStats} segment={segment} isLoading={isLoading} />
      
      <ChartCard
        distribution={statesDistribution}
        isLoading={isLoading}
        onBarClick={onStateClick}
      />
      
      <StatesTable
        stateRows={stateRows}
        segment={segment}
        isLoading={isLoading}
        onViewDetails={onStateClick}
      />
    </>
  );
} 