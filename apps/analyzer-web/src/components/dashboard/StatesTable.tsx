import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "./LoadingSpinner";
import { getSegmentLabel } from "./constants";
import type { StateRow, Segment } from "./types";

interface StatesTableProps {
  stateRows: StateRow[];
  segment: Segment;
  isLoading: boolean;
  onViewDetails: (state: string) => void;
}

export function StatesTable({ stateRows, segment, isLoading, onViewDetails }: StatesTableProps) {
  const countLabel = getSegmentLabel(segment);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">State-wise Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner message="Loading state data..." size="md" />
        ) : stateRows.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-right">#</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">{countLabel}</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stateRows.map((row, index) => (
                  <TableRow key={row.state}>
                    <TableCell className="text-right text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium break-words">{row.state}</TableCell>
                    <TableCell className="text-right">{row.techParks}</TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onViewDetails(row.state)}
                        className="w-full sm:w-auto"
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-muted-foreground">No state data available</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
