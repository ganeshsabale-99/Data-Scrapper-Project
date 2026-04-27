import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useRoleAccess } from "@/hooks/use-role-access";
import { GupioOverlayLoader } from "@/components/ui/gupio-loader";
import { hasPermission } from "@/lib/token";

interface RoleGuardProps {
  children: ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  fallbackPath?: string;
  showLoader?: boolean;
}


export function RoleGuard({
  children,
  requiredRoles = [],
  requiredPermissions = [],
  fallbackPath = "/dashboard",
  showLoader = true
}: RoleGuardProps) {
  const { userRole, canAccess, hasAnyRole } = useRoleAccess();

  if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
    if (!hasAnyRole) {
      return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
  }

  if (requiredRoles.length > 0) { // 4. Check Roles (Only if explicitly required by name, though permissions are preferred)
    const hasRequiredRoleAccess = requiredRoles.some((role) => userRole && userRole === role);

    if (!hasRequiredRoleAccess) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission => {
      if (permission.includes(".")) {
        return hasPermission(permission);
      }

      switch (permission) {
        case 'national':
          return canAccess.national;
        case 'state':
          return canAccess.state;
        case 'city':
          return canAccess.city;
        case 'fundingNews':
          return canAccess.fundingNews;
        case 'coworkingSpaces':
          return canAccess.coworkingSpaces;
        case 'analytics':
          return canAccess.analytics;
        case 'users':
          return canAccess.users;
        case 'notifications':
          return canAccess.notifications;
        case 'rbac':
          return canAccess.rbac;
        case 'techParks':
          return canAccess.techParks;
        default:
          return false;
      }
    });

    if (!hasAllPermissions) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  if (showLoader && !userRole) {
    return <GupioOverlayLoader text="Checking permissions..." />;
  }

  return <>{children}</>;
}

export function AdminOnly({ children, fallbackPath = "/dashboard" }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <RoleGuard requiredPermissions={["SYSTEM.ADMIN"]} fallbackPath={fallbackPath}>
      {children}
    </RoleGuard>
  );
}

export function SalesManagerOrHigher({ children, fallbackPath = "/dashboard" }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <RoleGuard requiredPermissions={["SCOPE.STATE_VIEW"]} fallbackPath={fallbackPath}>
      {children}
    </RoleGuard>
  );
}

export function SalesTeamOrHigher({ children, fallbackPath = "/dashboard" }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <RoleGuard requiredPermissions={["SCOPE.CITY_VIEW"]} fallbackPath={fallbackPath}>
      {children}
    </RoleGuard>
  );
}

export function RequirePermission({
  children,
  permission,
  fallbackPath = "/dashboard"
}: {
  children: ReactNode;
  permission: string;
  fallbackPath?: string;
}) {
  return (
    <RoleGuard requiredPermissions={[permission]} fallbackPath={fallbackPath}>
      {children}
    </RoleGuard>
  );
} 
