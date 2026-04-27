import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "./LoadingSpinner";
import type { CityRow, Segment } from "./types";

interface CitiesTableProps {
  cityRows: CityRow[];
  segment: Segment;
  isLoading: boolean;
  onViewDetails: (city: string) => void;
  title?: string;
  emptyMessage?: string;
}

export function CitiesTable({ 
  cityRows, 
  segment, 
  isLoading, 
  onViewDetails, 
  title = "City-wise Overview",
  emptyMessage = "No city data available"
}: CitiesTableProps) {
  const countLabel = segment === "coworkingSpaces" ? "Coworking Spaces" : "Tech Parks";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner message="Loading city data..." size="md" />
        ) : cityRows.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-right">#</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">{countLabel}</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cityRows.map((row, index) => (
                  <TableRow key={row.city}>
                    <TableCell className="text-right text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium break-words">{row.city}</TableCell>
                    <TableCell className="text-right">{row.techParks}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(row.city)}
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
              <p className="text-muted-foreground">{emptyMessage}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
