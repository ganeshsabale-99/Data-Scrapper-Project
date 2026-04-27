import { useEffect, useMemo, useState } from "react";
import {
  USER_UPDATED_EVENT,
  canPerformAction,
  getUserRole,
  hasPermission,
} from "@/lib/token";

export const useRoleAccess = () => {
  const [sessionVersion, setSessionVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setSessionVersion((prev) => prev + 1);
    window.addEventListener(USER_UPDATED_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(USER_UPDATED_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const userRole = useMemo(() => {
    // Ensure memo recomputes when session changes.
    void sessionVersion;
    return getUserRole();
  }, [sessionVersion]);

  const canAccess = useMemo(() => {
    // Ensure memo recomputes when session changes.
    void sessionVersion;
    return {
      national: canPerformAction("canAccessNational"),
      state: canPerformAction("canAccessState"),
      city: canPerformAction("canAccessCity"),
      fundingNews: canPerformAction("canAccessFundingNews"),
      coworkingSpaces: canPerformAction("canAccessCoworkingSpaces"),
      analytics: canPerformAction("canViewAnalytics"),
      users: canPerformAction("canManageUsers"),
      rbac: canPerformAction("canManageRbac"),
      notifications: canPerformAction("canAccessNotifications"),
      techParks: canPerformAction("canManageTechParks"),
    };
  }, [sessionVersion]);

  const roleAccess = useMemo(
    () => ({
      canAccessNational: canAccess.national,
      canAccessState: canAccess.state,
      canAccessCity: canAccess.city,
      canAccessFundingNews: canAccess.fundingNews,
      canAccessCoworkingSpaces: canAccess.coworkingSpaces,
      canAccessNotifications: canAccess.notifications,
      canManageUsers: canAccess.users,
      canManageRbac: canAccess.rbac,
      canViewAnalytics: canAccess.analytics,
      canManageTechParks: canAccess.techParks,
      canManageCoworkingSpaces: canAccess.coworkingSpaces,
      landingPage: canAccess.national
        ? "/dashboard/national"
        : canAccess.state
          ? "/dashboard/state"
          : canAccess.city
            ? "/dashboard/city"
            : "/dashboard",
    }),
    [canAccess],
  );

  const isAdmin = useMemo(
    () =>
      hasPermission("SYSTEM.ADMIN") ||
      hasPermission("SYSTEM.SUPER_ADMIN") ||
      canAccess.rbac,
    [canAccess.rbac],
  );

  const isSalesManager = useMemo(
    () =>
      !isAdmin &&
      (canAccess.state && (canAccess.techParks || canAccess.coworkingSpaces)),
    [canAccess.coworkingSpaces, canAccess.state, canAccess.techParks, isAdmin],
  );

  const isSalesExecutive = useMemo(
    () =>
      !isAdmin &&
      !isSalesManager &&
      hasPermission("TECHPARKS.VERIFY"),
    [isAdmin, isSalesManager],
  );

  const isSalesTeam = useMemo(
    () => !isAdmin && !isSalesManager && !isSalesExecutive && canAccess.city,
    [canAccess.city, isAdmin, isSalesExecutive, isSalesManager],
  );

  const isUser = useMemo(
    () => !isAdmin && !isSalesManager && !isSalesTeam && !isSalesExecutive,
    [isAdmin, isSalesExecutive, isSalesManager, isSalesTeam],
  );

  const hasAnyRole = useMemo(() => !!userRole, [userRole]);

  return {
    userRole,
    roleAccess,
    canAccess,
    isAdmin,
    isSalesManager,
    isSalesTeam,
    isSalesExecutive,
    isUser,
    hasAnyRole,
  };
};
