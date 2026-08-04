import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";

interface SidebarItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  onClick?: () => void;
}

export const SidebarItem = ({
  to,
  icon: Icon,
  label,
  collapsed,
  onClick,
}: SidebarItemProps) => {
  const location = useLocation();
  const toPath = to.split('?')[0] || to;
  const toSearch = to.includes('?') ? to.split('?')[1] : '';
  const targetTab = new URLSearchParams(toSearch).get('tab');
  const currentTab = new URLSearchParams(location.search).get('tab');
  const pathMatch = location.pathname === toPath ||
    (toPath !== "/dashboard" && location.pathname.startsWith(`${toPath}/`));
  const isActive = pathMatch && (targetTab ? currentTab === targetTab : true);

  const linkClasses = cn(
    "flex items-center rounded-lg transition-all duration-200 text-sm font-medium shadow-sm",
    isActive
      ? "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50 shadow-md"
      : "hover:bg-gradient-to-r hover:from-slate-100/80 hover:to-slate-200/80 dark:hover:from-slate-800/80 dark:hover:to-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:shadow-md"
  );

  const iconOnly = (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "p-2 rounded-lg transition-all duration-200",
        isActive
          ? "bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-700 dark:text-blue-300"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
      )}
    >
      <Icon className="w-5 h-5" />
    </motion.div>
  );

  const fullContent = (
    <motion.div
      className="flex items-center px-3 py-2.5 w-full"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
    >
      <div className={cn(
        "p-1.5 rounded-md mr-3 transition-all duration-200",
        isActive
          ? "bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-700 dark:text-blue-300"
          : "text-slate-600 dark:text-slate-400"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="font-medium">{label}</span>
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="ml-auto w-1.5 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shadow-sm"
          transition={{ duration: 0.1 }}
        />
      )}
    </motion.div>
  );

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return collapsed ? (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={to}
            className={cn(
              "flex justify-center p-2 rounded-lg transition-all duration-200",
              isActive ? "text-blue-700 dark:text-blue-300" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
            onClick={handleClick}
          >
            {iconOnly}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-slate-900/95 dark:bg-slate-100/95 text-slate-100 dark:text-slate-900 backdrop-blur-xl border-slate-700/50 dark:border-slate-300/50 shadow-xl">
          {label}
          {isActive && (
            <motion.div
              layoutId="sidebar-tooltip-active-indicator"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-r-full shadow-sm"
              transition={{ duration: 0.1 }}
            />
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <Link to={to} className={linkClasses} onClick={handleClick}>
      {fullContent}
    </Link>
  );
};
