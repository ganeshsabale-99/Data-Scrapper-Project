import { useMemo, useState } from "react";
import { AnalyticsChart } from "@/components/charts/analyticsChart";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ChartType } from "@/components/types";

export type StatusChartProps = {
  title?: string;
  distribution: { labels: string[]; values: number[] };
  onSelect?: (label: string) => void;
  height?: number;
  chartType?: ChartType;
  enableExpand?: boolean; // fullscreen modal (optional)
  defaultOpen?: boolean;   // inline collapse/open
};

export function StatusChart({ title = "Analytics Overview", distribution, onSelect, height = 300, chartType = "bar", enableExpand = false, defaultOpen = false }: StatusChartProps) {
  const [openModal, setOpenModal] = useState(false);
  const [isOpen, setIsOpen] = useState(!!defaultOpen);
  const total = useMemo(() => distribution.values.reduce((a, b) => a + b, 0), [distribution.values]);
  const legend = useMemo(() => distribution.labels.map((l, i) => ({
    label: l,
    value: distribution.values[i] || 0,
    pct: total > 0 ? ((distribution.values[i] || 0) / total) * 100 : 0,
  })), [distribution, total]);

  const Chart = (
    <div className={`h-[${height}px]`}>
      <AnalyticsChart type={chartType} data={{}} distribution={distribution} onElementClick={onSelect} />
    </div>
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <button className="flex items-center gap-2 text-base font-medium" onClick={() => setIsOpen((v) => !v)}>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {title}
        </button>
        <div className="flex items-center gap-2">
          {enableExpand && (
            <Button variant="outline" size="sm" onClick={() => setOpenModal(true)} className="gap-1">
              <Maximize2 className="h-4 w-4" />
              Expand
            </Button>
          )}
        </div>
      </div>

      {isOpen && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
            {legend.map((x) => (
              <div key={x.label} className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-muted" />
                <span className="font-medium">{x.label}:</span>
                <span>
                  {x.value} ({x.pct.toFixed(2)}%)
                </span>
              </div>
            ))}
          </div>
          {Chart}
        </>
      )}

      {enableExpand && (
        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogContent className="max-w-5xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-medium">{title}</h3>
              <Button variant="outline" size="sm" onClick={() => setOpenModal(false)} className="gap-1">
                <Minimize2 className="h-4 w-4" />
                Close
              </Button>
            </div>
            <div className="h-[520px]">
              <AnalyticsChart type={chartType} data={{}} distribution={distribution} onElementClick={onSelect} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default StatusChart;