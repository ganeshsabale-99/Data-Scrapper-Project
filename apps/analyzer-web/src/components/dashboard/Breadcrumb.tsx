import { useNavigate } from "react-router";
import type { BreadcrumbItem } from "./types";

interface BreadcrumbProps {
  breadcrumbs: BreadcrumbItem[];
}

export function Breadcrumb({ breadcrumbs }: BreadcrumbProps) {
  const navigate = useNavigate();

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center">
          {index > 0 && (
            <span className="flex items-center">
              <span className="mx-2">/</span>
            </span>
          )}
          <button
            onClick={() => navigate(crumb.path)}
            className={`hover:text-foreground transition-colors ${
              crumb.active ? "text-foreground font-medium" : ""
            }`}
          >
            {crumb.label}
          </button>
        </div>
      ))}
    </nav>
  );
} 