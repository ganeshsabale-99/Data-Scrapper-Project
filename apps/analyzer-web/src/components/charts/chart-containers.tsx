import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, PieChart, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { ChartType } from "../types/index";
import { AnalyticsChart } from "./analyticsChart";
import { Bar, Pie } from "react-chartjs-2";

type AnalyticsData = {
  statusCounts?: Record<string, number>;
  statusPercentages?: Record<string, number>;
};

type TooltipContext = {
  label?: string;
  raw?: unknown;
};

type AnimationContext = {
  type?: string;
  dataIndex?: number;
};

type ChartElement = {
  index: number;
};

interface ChartContainerProps {
  data: AnalyticsData;
  isLoading?: boolean;
  distribution?: { labels: string[]; values: number[] };
  onBarClick?: (label: string) => void;
}

const chartTypes = [
  { value: "bar" as ChartType, label: "Bar Chart", icon: BarChart3 },
  { value: "pie" as ChartType, label: "Pie Chart", icon: PieChart },
];

const getChartColors = (labels: string[], chartType: ChartType) => {
  const cityColors = [
    "rgba(59, 130, 246, 0.8)", // Blue
    "rgba(251, 191, 36, 0.8)", // Yellow
    "rgba(168, 85, 247, 0.8)", // Purple
    "rgba(249, 115, 22, 0.8)", // Orange
    "rgba(34, 197, 94, 0.8)", // Green
    "rgba(239, 68, 68, 0.8)", // Red
    "rgba(16, 185, 129, 0.8)", // Emerald
    "rgba(245, 158, 11, 0.8)", // Amber
    "rgba(139, 92, 246, 0.8)", // Violet
    "rgba(236, 72, 153, 0.8)", // Pink
  ];

  const statusColors = [
    "rgba(59, 130, 246, 0.8)", // Blue - NOT_CONTACTED (matches contact-status.ts bg-blue-100)
    "rgba(251, 191, 36, 0.8)", // Yellow - CONTACTED (matches contact-status.ts bg-yellow-100)
    "rgba(168, 85, 247, 0.8)", // Purple - INTERESTED (matches contact-status.ts bg-purple-100)
    "rgba(249, 115, 22, 0.8)", // Orange - MEETING_SCHEDULED (matches contact-status.ts bg-orange-100)
    "rgba(34, 197, 94, 0.8)", // Green - PROPOSAL_SENT (matches contact-status.ts bg-green-100)
    "rgba(236, 72, 153, 0.8)", // Pink - IN_PROGRESS
    "rgba(239, 68, 68, 0.8)", // Red - CLOSED
  ];

  const borderColors = [
    "rgba(239, 68, 68, 1)", // Red
    "rgba(59, 130, 246, 1)", // Blue
    "rgba(168, 85, 247, 1)", // Purple
    "rgba(249, 115, 22, 1)", // Orange
    "rgba(34, 197, 94, 1)", // Green
    "rgba(156, 163, 175, 1)", // Gray
    "rgba(16, 185, 129, 1)", // Emerald
    "rgba(245, 158, 11, 1)", // Amber
    "rgba(139, 92, 246, 1)", // Violet
    "rgba(236, 72, 153, 1)", // Pink
  ];

  const isStatusChart = labels.some((label) =>
    [
      "NOT_CONTACTED",
      "CONTACTED",
      "INTERESTED",
      "MEETING_SCHEDULED",
      "PROPOSAL_SENT",
      "IN_PROGRESS",
      "CLOSED",
    ].includes(label),
  );

  const backgroundColor = labels.map((_, i) => {
    if (isStatusChart) {
      return statusColors[i % statusColors.length];
    }
    return cityColors[i % cityColors.length];
  });

  const borderColor = labels.map(
    (_, i) => borderColors[i % borderColors.length],
  );

  if (chartType === "pie") {
    return { backgroundColor, borderColor };
  }

  const barBackgroundColor = backgroundColor.map((color) =>
    color.replace("0.8", "0.5"),
  );
  return { backgroundColor: barBackgroundColor, borderColor };
};

export function ChartContainer({
  data,
  isLoading,
  distribution,
  onBarClick,
}: ChartContainerProps) {
  const [selectedChart, setSelectedChart] = useState<ChartType>("bar");
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <motion.div
        className="flex flex-row items-center justify-between space-y-0 pb-2 mb-4"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut", delay: 0.05 }}
      >
        <h3 className="text-base font-medium">Analytics Overview</h3>
        <div className="flex items-center gap-2">
          <Select
            value={selectedChart}
            onValueChange={(value: ChartType) => setSelectedChart(value)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chartTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </motion.div>
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div>
              {!distribution && (
                <div className="mb-3 flex flex-wrap gap-4 text-xs">
                  {(() => {
                    const statusOrder = [
                      "NOT_CONTACTED",
                      "CONTACTED",
                      "INTERESTED",
                      "MEETING_SCHEDULED",
                      "PROPOSAL_SENT",
                      "IN_PROGRESS",
                      "CLOSED",
                    ];
                    const labels =
                      data && data.statusCounts
                        ? statusOrder.filter((s) =>
                            Object.prototype.hasOwnProperty.call(
                              data.statusCounts,
                              s,
                            ),
                          )
                        : [];
                    // Use the same color scheme as the chart for consistency
                    const statusColors = [
                      "rgba(59, 130, 246, 1)", // Blue - NOT_CONTACTED (matches chart)
                      "rgba(251, 191, 36, 1)", // Yellow - CONTACTED (matches chart)
                      "rgba(168, 85, 247, 1)", // Purple - INTERESTED (matches chart)
                      "rgba(249, 115, 22, 1)", // Orange - MEETING_SCHEDULED (matches chart)
                      "rgba(34, 197, 94, 1)", // Green - PROPOSAL_SENT (matches chart)
                      "rgba(236, 72, 153, 1)", // Pink - IN_PROGRESS (matches chart)
                      "rgba(239, 68, 68, 1)", // Red - CLOSED (matches chart)
                    ];
                    return labels.map((label, index) => {
                      const color = statusColors[index % statusColors.length];
                      const count = data?.statusCounts?.[label] ?? 0;
                      const percent = data?.statusPercentages?.[label];
                      const percentText =
                        typeof percent === "number" ? `${percent}%` : "0%";
                      return (
                        <div key={label} className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-sm"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-muted-foreground">
                            {label}: {count} ({percentText})
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
              <div className="h-[300px] w-full">
                {distribution ? (
                  <DynamicChart
                    type={selectedChart}
                    labels={distribution.labels}
                    values={distribution.values}
                    onBarClick={onBarClick}
                  />
                ) : (
                  <AnalyticsChart
                    type={selectedChart}
                    data={data}
                    isLoading={isLoading}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DynamicChart({
  type,
  labels,
  values,
  onBarClick,
}: {
  type: ChartType;
  labels: string[];
  values: number[];
  onBarClick?: (label: string) => void;
}) {
  const colors = getChartColors(labels, type);

  if (type === "pie") {
    const pieData = {
      labels,
      datasets: [
        {
          label: "Distribution",
          data: values,
          backgroundColor: colors.backgroundColor,
          borderWidth: 0,
        },
      ],
    };

    const pieOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 750,
        easing: "easeInOutQuart" as const,
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom" as const,
        },
        tooltip: {
          callbacks: {
            label: function (context: TooltipContext) {
              const label = context.label || "";
              const value =
                typeof context.raw === "number" ? context.raw : 0;
              const total = values.reduce((sum, val) => sum + val, 0);
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) : "0";
              return `${label}: ${value} (${percentage}%)`;
            },
          },
        },
      },
      onClick: (_event: unknown, elements: ChartElement[]) => {
        if (!onBarClick) return;
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          const label = labels[index];
          onBarClick(label);
        }
      },
    };

    return <Pie data={pieData} options={pieOptions} />;
  }

  const barData = {
    labels,
    datasets: [
      {
        label: "Distribution",
        data: values,
        backgroundColor: colors.backgroundColor,
        borderWidth: 0,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 650,
      easing: "easeOutQuart" as const,
      delay: (ctx: AnimationContext) => {
        if (ctx?.type !== "data") return 0;
        const i = typeof ctx.dataIndex === "number" ? ctx.dataIndex : 0;
        const count = labels.length;
        const stepMs = count > 28 ? 10 : 18;
        return i * stepMs;
      },
      onComplete: () => {
      },
    },
    onClick: (_event: unknown, elements: ChartElement[]) => {
      if (!onBarClick) return;
      if (elements && elements.length > 0) {
        const index = elements[0].index;
        const label = labels[index];
        onBarClick(label);
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(156, 163, 175, 0.1)",
        },
        ticks: {
          color: "rgba(156, 163, 175, 1)",
        },
      },
      x: {
        grid: {
          color: "rgba(156, 163, 175, 0.1)",
        },
        ticks: {
          color: "rgba(156, 163, 175, 1)",
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: TooltipContext) {
            const label = context.label || "";
            const value =
              typeof context.raw === "number" ? context.raw : 0;
            return `${label}: ${value}`;
          },
        },
      },
    },
  };

  return <Bar data={barData} options={barOptions} />;
}
