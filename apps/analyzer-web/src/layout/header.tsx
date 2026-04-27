import { Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsBelowLg } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { logout } from '@/lib/auth';
import { useNavigate } from 'react-router';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  // const isMobile = useIsMobile();
  const isBelowLg = useIsBelowLg();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  };

  return (
    <header className="relative border-b border-white/10 bg-gradient-to-r from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-900/95 dark:via-slate-800/90 dark:to-slate-900/95 backdrop-blur-xl shadow-sm">
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>
      
      <div className="w-full pl-3 pr-4 py-3 lg:py-4 flex justify-between items-center relative">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile Menu Button */}
          {isBelowLg && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-2 lg:hidden flex-shrink-0 hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-lg lg:text-xl font-semibold truncate bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">Gupio Analytics</span>
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">Intelligence & Analytics</span>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
          {isBelowLg && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20 dark:hover:bg-white/10 transition-colors">
                  <LogOut className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50 shadow-xl">
                <DropdownMenuItem 
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" 
                  onSelect={(e) => { 
                    e.preventDefault(); 
                    handleLogout(); 
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}