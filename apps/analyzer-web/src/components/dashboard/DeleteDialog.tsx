import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationToDelete: { name?: string } | null;
  isDeleting: boolean;
  onConfirmDelete: () => void;
}

export function DeleteDialog({ 
  open, 
  onOpenChange, 
  locationToDelete, 
  isDeleting, 
  onConfirmDelete 
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-h-[240px] sm:min-h-[260px] p-6 sm:p-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Are you sure want to delete
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md">
            This action will permanently remove the selected tech park from your list and cannot be undone.
          </p>
          <div className="mt-2">
            <span className="inline-block px-4 py-2 rounded-md bg-destructive/10 text-destructive font-bold text-xl sm:text-2xl">
              {locationToDelete?.name || 'this tech park'}
            </span>
          </div>
        </div>
        <div className="mt-6 flex w-full items-center justify-center gap-3 sm:gap-4">
          <Button
            variant="outline"
            onClick={() => {
              if (!isDeleting) {
                onOpenChange(false);
              }
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirmDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
