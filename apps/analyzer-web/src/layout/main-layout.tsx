import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Outlet } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useIsMobile, useIsBelowLg } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
export const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const isBelowLg = useIsBelowLg();

  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);



  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <AuthGuard>
      <RoleGuard>
        <section className="h-screen flex overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          {/* Desktop Sidebar - hidden below lg */}
          <div className="hidden lg:block">
            <Sidebar />
          </div>

          {/* Sidebar Overlay for < lg */}
          {isBelowLg && sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={closeSidebar}
            />
          )}

          {/* Sidebar Drawer for < lg */}
          {isBelowLg && (
            <div className={`fixed left-0 top-0 h-full z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}>
              <Sidebar onClose={closeSidebar} isMobile={true} />
            </div>
          )}

          <section className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center">
                  {isBelowLg ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors"
                      onClick={toggleSidebar}
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  ) : (
                    <div className="w-9" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm w-full min-w-0 shadow-inner">
              <Outlet />
            </div>
          </section>
        </section>
      </RoleGuard>
    </AuthGuard>
  );
};
