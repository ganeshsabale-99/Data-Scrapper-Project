import { Breadcrumb } from "./Breadcrumb";
import type { BreadcrumbItem } from "./types";

interface DashboardHeaderProps {
  title: string;
  breadcrumbs: BreadcrumbItem[];
}

export function DashboardHeader({ title, breadcrumbs }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      
      <Breadcrumb breadcrumbs={breadcrumbs} />
    </div>
  );
} 