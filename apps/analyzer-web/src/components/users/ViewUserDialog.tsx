import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { AdminUserDto } from "@/services/usersService";

interface ViewUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUserDto | null;
}

export function ViewUserDialog({ open, onOpenChange, user }: ViewUserDialogProps) {
  const displayPhone =
    user?.phoneNumber && !user.phoneNumber.toLowerCase().startsWith("mail:")
      ? user.phoneNumber
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">User details</h3>
          {user ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Name</div>
                <div className="font-medium">{user.name || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Email</div>
                <div className="font-medium">{user.email || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Phone</div>
                <div className="font-medium">{displayPhone || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Role</div>
                <div className="font-medium uppercase">{(user.roleName || user.role || '-').replaceAll("_", " ")}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Requested Role</div>
                <div className="font-medium">{(user.requestedRoleName || user.requestedRole || '-').replaceAll("_", " ")}</div>
              </div>
              <div>
                <div className="text-muted-foreground">City</div>
                <div className="font-medium">{user.city || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">State</div>
                <div className="font-medium">{user.state || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <div className="font-medium">{user.status ? user.status.replaceAll("_", " ") : (user.isActive ? 'Active' : 'Inactive')}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Email Verified</div>
                <div className="font-medium">{(user.isEmailVerified ?? user.isMobileVerified) ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Admin Approved</div>
                <div className="font-medium">{user.isApprovedByAdmin ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Company Name</div>
                <div className="font-medium">{user.companyName || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Company Details</div>
                <div className="font-medium">{user.companyDetails || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Created</div>
                <div className="font-medium">{new Date(user.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
