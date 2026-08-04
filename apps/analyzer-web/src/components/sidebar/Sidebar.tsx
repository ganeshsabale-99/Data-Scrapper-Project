import { useEffect, useMemo, useState } from "react";
import { SidebarItem } from "./SidebarItem";
import { SidebarGroup } from "./SidebarGroup";
import {
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  User,
  LogOut,
  Globe,
  MapPin,
  Flag,
  X,
  Newspaper,
  Users,
  FileText,
  Shield,
  Building2,
  UserCog,
  Key,
  Briefcase,
  ShoppingBag,
  Activity,
  Trophy,
  Plane,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";




import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  USER_UPDATED_EVENT,
  canPerformAction,
  getUser,
  getUserCity,
  getUserRole,
  getUserState,
  hasPermission,
} from "@/lib/token";
import { logout } from "@/lib/auth";
import { useNavigate } from "react-router";

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

export const Sidebar = ({ onClose, isMobile = false }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handleSessionUpdate = () => setSessionVersion((prev) => prev + 1);
    window.addEventListener(USER_UPDATED_EVENT, handleSessionUpdate);
    window.addEventListener("storage", handleSessionUpdate);
    return () => {
      window.removeEventListener(USER_UPDATED_EVENT, handleSessionUpdate);
      window.removeEventListener("storage", handleSessionUpdate);
    };
  }, []);

  const storedUser = useMemo(() => {
    void sessionVersion;
    return getUser();
  }, [sessionVersion]);
  const userRole = useMemo(() => {
    void sessionVersion;
    return getUserRole();
  }, [sessionVersion]);
  const userCity = useMemo(() => {
    void sessionVersion;
    return getUserCity();
  }, [sessionVersion]);
  const userState = useMemo(() => {
    void sessionVersion;
    return getUserState();
  }, [sessionVersion]);
  const cityDashboardPath = useMemo(() => {
    if (!userCity) return "/dashboard/city";
    if (userState) {
      return `/dashboard/city/${encodeURIComponent(userState)}/${encodeURIComponent(userCity)}`;
    }
    return `/dashboard/city/${encodeURIComponent(userCity)}`;
  }, [userCity, userState]);

  const stateBase = useMemo(() => {
    return userState ? `/dashboard/state/${encodeURIComponent(userState)}` : "/dashboard/state";
  }, [userState]);

  const displayName = storedUser?.name || "User";
  const displayEmail = storedUser?.email || "";
  const rawPhone = (storedUser?.phoneNumber || "").trim();
  const displayPhone = rawPhone && !rawPhone.toLowerCase().startsWith("mail:") ? rawPhone : "";
  const initials = useMemo(() => {
    const parts = (displayName || "").trim().split(/\s+/);
    const first = parts[0]?.[0] || "U";
    const second = parts[1]?.[0] || "";
    return (first + second).toUpperCase();
  }, [displayName]);

  const roleAccess = useMemo(() => {
    void sessionVersion;
    return {
      canAccessNational: canPerformAction("canAccessNational"),
      canAccessState: canPerformAction("canAccessState"),
      canAccessCity: canPerformAction("canAccessCity"),
      canAccessFundingNews: canPerformAction("canAccessFundingNews"),
      canAccessCoworkingSpaces: canPerformAction("canAccessCoworkingSpaces"),

      canManageUsers: canPerformAction("canManageUsers"),
      canManageRbac: canPerformAction("canManageRbac"),
      canViewAnalytics: canPerformAction("canViewAnalytics"),
      canManageTechParks: canPerformAction("canManageTechParks"),
      canManageCoworkingSpaces: canPerformAction("canManageCoworkingSpaces"),
      canAccessExternalApi: hasPermission("SYSTEM.SUPER_ADMIN"), // Added for External API
    };
  }, [sessionVersion]);



  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  };

  // Don't show collapse button on mobile
  const showCollapseButton = !isMobile;

  return (
    <div className={`relative h-screen ${isMobile ? 'w-64' : ''}`}>
      <motion.aside
        className={`h-full flex flex-col border-r border-slate-200/50 dark:border-slate-700/50 shadow-xl ${isMobile
          ? "w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl"
          : "bg-gradient-to-b from-white/90 via-slate-50/80 to-slate-100/90 dark:from-slate-900/95 dark:via-slate-800/90 dark:to-slate-900/95 backdrop-blur-xl"
          } ${collapsed ? "w-20" : "w-64"}`}
        initial={{ width: isMobile ? 256 : 256 }}
        animate={{ width: isMobile ? 256 : collapsed ? 80 : 256 }}
        transition={{ duration: 0.15, ease: "easeInOut" }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>

        {/* Logo and Company Name Section */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <AnimatePresence>
              {(!collapsed || isMobile) && (
                <motion.div
                  className="flex flex-col min-w-0"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                >
                  <span className="text-lg font-semibold truncate bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">Gupio Analytics</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400 truncate">Intelligence & Analytics</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Close Button */}
          {isMobile && onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* National Tab - Only for Admin */}
          {roleAccess.canAccessNational && (
            collapsed && !isMobile ? (
              <SidebarItem
                to="/dashboard/national?tab=techParks"
                icon={Globe}
                label="National"
                collapsed={true}
                onClick={isMobile ? onClose : undefined}
              />
            ) : (
              <SidebarGroup title="National" collapsed={false}>
                <SidebarItem to="/dashboard/national?tab=techParks" icon={Building2} label="Tech Parks" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to="/dashboard/national?tab=coworkingSpaces" icon={Briefcase} label="Coworking Spaces" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to="/dashboard/national?tab=malls" icon={ShoppingBag} label="Malls" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to="/dashboard/national?tab=hospitals" icon={Activity} label="Hospitals" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to="/dashboard/national?tab=stadiums" icon={Trophy} label="Stadiums" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to="/dashboard/national?tab=airports" icon={Plane} label="Airports" collapsed={false} onClick={isMobile ? onClose : undefined} />
              </SidebarGroup>
            )
          )}

          {/* State Tab - For Admin and Sales Manager */}
          {roleAccess.canAccessState && (
            collapsed && !isMobile ? (
              <SidebarItem
                to={`${stateBase}?tab=techParks`}
                icon={Flag}
                label={userState ? `State (${userState})` : "State"}
                collapsed={true}
                onClick={isMobile ? onClose : undefined}
              />
            ) : (
              <SidebarGroup title={userState ? `State (${userState})` : "State"} collapsed={false}>
                <SidebarItem to={`${stateBase}?tab=techParks`} icon={Building2} label="Tech Parks" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to={`${stateBase}?tab=coworkingSpaces`} icon={Briefcase} label="Coworking Spaces" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to={`${stateBase}?tab=malls`} icon={ShoppingBag} label="Malls" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to={`${stateBase}?tab=hospitals`} icon={Activity} label="Hospitals" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to={`${stateBase}?tab=stadiums`} icon={Trophy} label="Stadiums" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to={`${stateBase}?tab=airports`} icon={Plane} label="Airports" collapsed={false} onClick={isMobile ? onClose : undefined} />
              </SidebarGroup>
            )
          )}

          {/* City Tab - For all roles */}
          {roleAccess.canAccessCity && (
            collapsed && !isMobile ? (
              <SidebarItem
                to={`${cityDashboardPath}?tab=techParks`}
                icon={MapPin}
                label={userCity ? `City (${userCity})` : "City"}
                collapsed={true}
                onClick={isMobile ? onClose : undefined}
              />
            ) : (
              <SidebarGroup title={userCity ? `City (${userCity})` : "City"} collapsed={false}>
                <SidebarItem to={`${cityDashboardPath}?tab=techParks`} icon={Building2} label="Tech Parks" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to={`${cityDashboardPath}?tab=coworkingSpaces`} icon={Briefcase} label="Coworking Spaces" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to={`${cityDashboardPath}?tab=malls`} icon={ShoppingBag} label="Malls" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to={`${cityDashboardPath}?tab=hospitals`} icon={Activity} label="Hospitals" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to={`${cityDashboardPath}?tab=stadiums`} icon={Trophy} label="Stadiums" collapsed={false} onClick={isMobile ? onClose : undefined} />
                <SidebarItem to={`${cityDashboardPath}?tab=airports`} icon={Plane} label="Airports" collapsed={false} onClick={isMobile ? onClose : undefined} />
              </SidebarGroup>
            )
          )}

          {/* Funding News Tab - For Admin, Sales Manager, Sales Team, and Sales Executive */}
          {roleAccess.canAccessFundingNews && (
            <SidebarItem
              to="/dashboard/funding-news"
              icon={Newspaper}
              label="Funding News"
              collapsed={collapsed && !isMobile}
              onClick={isMobile ? onClose : undefined}
            />
          )}

          {/* Reports Tab - Accessible to users who can view tech parks */}
          {roleAccess.canManageTechParks && (
            <SidebarItem
              to="/dashboard/reports"
              icon={FileText}
              label="Reports"
              collapsed={collapsed && !isMobile}
              onClick={isMobile ? onClose : undefined}
            />
          )}


          {/* Users Tab - Only for roles that can manage users (e.g., Admin) */}
          {roleAccess.canManageUsers && (
            <SidebarItem
              to="/dashboard/users"
              icon={Users}
              label="Users"
              collapsed={collapsed && !isMobile}
              onClick={isMobile ? onClose : undefined}
            />
          )}

          {roleAccess.canManageRbac && (
            <>
              <SidebarItem
                to="/dashboard/departments"
                icon={Building2}
                label="Departments"
                collapsed={collapsed && !isMobile}
                onClick={isMobile ? onClose : undefined}
              />
              <SidebarItem
                to="/dashboard/roles"
                icon={UserCog}
                label="Roles"
                collapsed={collapsed && !isMobile}
                onClick={isMobile ? onClose : undefined}
              />
              <SidebarItem
                to="/dashboard/permissions"
                icon={Shield}
                label="Permissions"
                collapsed={collapsed && !isMobile}
                onClick={isMobile ? onClose : undefined}
              />
            </>
          )}

          {roleAccess.canAccessExternalApi && (
            <SidebarItem
              to="/dashboard/external-api"
              icon={Key}
              label="External API"
              collapsed={collapsed && !isMobile}
              onClick={isMobile ? onClose : undefined}
            />
          )}









        </nav>

        {/* User Profile Section */}
        <div className="border-t border-slate-200/50 dark:border-slate-700/50 p-4 pb-6">
          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 ring-2 ring-blue-100 dark:ring-blue-900/30">
                    <AvatarImage src="/avatars/01.png" alt="User" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{displayName}</span>
                    {displayEmail && (
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{displayEmail}</span>
                    )}
                    {userRole && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium capitalize truncate">
                        {userRole.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50 shadow-xl">
                    <DropdownMenuItem onSelect={() => { navigate("/dashboard/profile"); if (isMobile && onClose) onClose(); }} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                      <User className="mr-2 h-4 w-4" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" onSelect={(e) => { e.preventDefault(); handleLogout(); }}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            )}
            {collapsed && !isMobile && (
              <motion.div
                className="flex justify-center"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <Avatar className="h-8 w-8 ring-2 ring-blue-100 dark:ring-blue-900/30">
                  <AvatarImage src="/avatars/01.png" alt="User" />
                  <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">My Profile</DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400">View your account details</DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12 ring-2 ring-blue-100 dark:ring-blue-900/30">
                <AvatarImage src="/avatars/01.png" alt="User" />
                <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Name: </span>
                  <span className="text-slate-700 dark:text-slate-300">{displayName}</span>
                </div>
                {displayPhone && (
                  <div className="text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-200">Phone: </span>
                    <span className="text-slate-700 dark:text-slate-300">{displayPhone}</span>
                  </div>
                )}
                {displayEmail && (
                  <div className="text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-200">Email: </span>
                    <span className="text-slate-700 dark:text-slate-300">{displayEmail}</span>
                  </div>
                )}
                {userRole && (
                  <div className="text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-200">Role: </span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium capitalize">
                      {userRole.replace('_', ' ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AnimatePresence>
          {(!collapsed || isMobile) && (
            <motion.div
              className="p-4 pb-6 border-t border-slate-200/50 dark:border-slate-700/50 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              © {new Date().getFullYear()} Gupio. All rights reserved.
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      {/* Collapse Button - Only show on desktop */}
      {showCollapseButton && (
        <Button
          variant="outline"
          size="icon"
          className={`absolute top-4 rounded-full w-6 h-6 p-0 z-10 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 backdrop-blur-sm border-blue-400 dark:border-blue-500 shadow-lg text-white transition-all duration-200 ${collapsed ? "left-[68px]" : "left-[248px]"
            }`}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </Button>
      )}
    </div>
  );
};
