import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function UserManagementNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "Users", path: "/dashboard/users" },
    { label: "Departments", path: "/dashboard/departments" },
    { label: "Roles", path: "/dashboard/roles" },
    { label: "Permission Matrix", path: "/dashboard/permissions" },
  ];

  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit border border-slate-200 dark:border-slate-700 shadow-sm">
      {navItems.map((item) => (
        <Button
          key={item.path}
          variant={location.pathname === item.path ? "default" : "ghost"}
          className={`rounded-md px-6 transition-all ${
            location.pathname === item.path
              ? "shadow-sm font-semibold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
          onClick={() => navigate(item.path)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
