import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, MoreHorizontal, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = '',
}) => {
  const isMobile = useIsMobile();

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const getVisiblePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const handlePageClick = (page: number | string) => {
    if (typeof page === 'number') {
      onPageChange(page);
    }
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`px-3 sm:px-4 py-3 sm:py-4 border-t bg-background ${className}`}>
      {/* Mobile Layout */}
      {isMobile ? (
        <div className="space-y-3">
          {/* Pagination controls - Top */}
          <div className="flex items-center justify-center gap-3">
            {/* Previous button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-10 px-4 flex items-center gap-2 min-w-[80px]"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Previous</span>
            </Button>

            {/* Page indicator */}
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg border min-w-[80px] justify-center">
              <span className="text-sm font-semibold text-foreground">{currentPage}</span>
              <span className="text-sm text-muted-foreground">of</span>
              <span className="text-sm text-muted-foreground">{totalPages}</span>
            </div>

            {/* Next button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-10 px-4 flex items-center gap-2 min-w-[80px]"
            >
              <span className="text-sm font-medium">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Entry count - Bottom */}
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              {totalItems > 0 ? (
                `Showing ${startIndex} to ${endIndex} of ${totalItems} entries`
              ) : (
                "No entries found."
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Desktop Layout */
        <div className="flex items-center justify-between gap-4">
          {/* Entry count */}
          <div className="text-sm text-muted-foreground">
            {totalItems > 0 ? (
              `Showing ${startIndex} to ${endIndex} of ${totalItems} entries`
            ) : (
              "No entries found."
            )}
          </div>

          {/* Pagination controls */}
          <div className="flex items-center gap-2">
            {/* First page button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0 flex items-center justify-center"
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            {/* Previous button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0 flex items-center justify-center"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {getVisiblePages().map((page, index) => (
                <React.Fragment key={index}>
                  {page === '...' ? (
                    <div className="flex items-center justify-center w-8 h-8">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : (
                    <Button
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageClick(page)}
                      className="h-8 w-8 p-0"
                    >
                      {page}
                    </Button>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Next button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0 flex items-center justify-center"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Last page button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0 flex items-center justify-center"
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
