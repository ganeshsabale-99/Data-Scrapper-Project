import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
} from "chart.js";
import { Bar, Pie, Line, Radar } from "react-chartjs-2";
import type { ChartType } from "../types/index";

type StatusChartState = {
  statusCounts?: Record<string, number>;
  statusPercentages?: Record<string, number>;
};

type WaveDataset = { data: number[] };
type WaveData = {
  labels: string[];
  datasets: WaveDataset[];
};

type WaveOptions = {
  plugins?: Record<string, unknown>;
} & Record<string, unknown>;

type ChartAnimationContext = {
  type?: string;
  dataIndex?: number;
  chart?: {
    data?: {
      labels?: unknown[];
    };
  };
};

type ChartTooltipContext = {
  label?: string;
  raw?: unknown;
};

type ChartClickPoint = { index: number };
type ChartClickRef = {
  getElementsAtEventForMode: (
    event: Event,
    mode: "nearest",
    options: { intersect: boolean },
    useFinalPosition: boolean,
  ) => ChartClickPoint[];
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
);

interface AnalyticsChartProps {
  type: ChartType;
  data: StatusChartState;
  isLoading?: boolean;
  distribution?: { labels: string[]; values: number[] };
  onElementClick?: (label: string) => void;
}

const WaveChart: React.FC<{ data: WaveData; options: WaveOptions }> = ({
  data,
  options,
}) => {
  const mountainData = {
    labels: data.labels,
    datasets: [
      {
        label: "Mountain Wave",
        data: data.datasets[0].data,
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "rgba(59, 130, 246, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBorderWidth: 2,
        pointHoverBackgroundColor: "rgba(59, 130, 246, 0.8)",
        pointHoverBorderColor: "#fff",
      },
    ],
  };

  const mountainOptions = {
    ...options,
    plugins: {
      ...options.plugins,
      legend: {
        display: true,
        position: "top" as const,
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: true,
          color: "rgba(156, 163, 175, 0.1)",
        },
        ticks: {
          color: "rgba(156, 163, 175, 1)",
        },
      },
      y: {
        display: true,
        grid: {
          color: "rgba(156, 163, 175, 0.1)",
        },
        ticks: {
          color: "rgba(156, 163, 175, 1)",
        },
        beginAtZero: true,
      },
    },
    elements: {
      point: {
        hoverRadius: 6,
      },
    },
  };

  return <Line data={mountainData} options={mountainOptions} />;
};

export function AnalyticsChart({
  type,
  data,
  isLoading,
  distribution,
  onElementClick,
}: AnalyticsChartProps) {
  const chartRef = React.useRef(null);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading chart data...
        </div>
      </div>
    );
  }

  const isBar = type === "bar";

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: isBar
      ? {
          duration: 650,
          easing: "easeOutQuart" as const,
          delay: (ctx: ChartAnimationContext) => {
            if (ctx?.type !== "data") return 0;
            const i = typeof ctx.dataIndex === "number" ? ctx.dataIndex : 0;
            const count =
              Array.isArray(ctx?.chart?.data?.labels) &&
              ctx.chart.data.labels.length > 0
                ? ctx.chart.data.labels.length
                : 0;
            const stepMs = count > 28 ? 10 : 18;
            return i * stepMs;
          },
        }
      : {
          duration: 750,
          easing: "easeInOutQuart" as const,
          onComplete: () => {
          },
        },
    plugins: {
      legend: {
        display: false,
        position: "top" as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: ChartTooltipContext) {
            const label = context.label || "";
            const value = typeof context.raw === "number" ? context.raw : 0;
            if (distribution) {
              return `${label}: ${value}`;
            }
            const percentages =
              data && data.statusPercentages ? data.statusPercentages : {};
            const percent =
              typeof percentages[label] === "number"
                ? percentages[label]
                : undefined;
            return percent !== undefined
              ? `${label}: ${value} (${percent}%)`
              : `${label}: ${value}`;
          },
        },
      },
    },
    scales:
      type === "pie" || type === "radar"
        ? undefined
        : {
            y: {
              beginAtZero: true,
            },
          },
  };

  const baseColors = [
    "rgba(59, 130, 246, 0.5)",
    "rgba(251, 191, 36, 0.5)",
    "rgba(168, 85, 247, 0.5)",
    "rgba(249, 115, 22, 0.5)",
    "rgba(34, 197, 94, 0.5)",
    "rgba(236, 72, 153, 0.5)",
    "rgba(239, 68, 68, 0.5)",
  ];

  const borderColors = [
    "rgba(59, 130, 246, 1)",
    "rgba(251, 191, 36, 1)",
    "rgba(168, 85, 247, 1)",
    "rgba(249, 115, 22, 1)",
    "rgba(34, 197, 94, 1)",
    "rgba(236, 72, 153, 1)",
    "rgba(239, 68, 68, 1)",
  ];

  const labels = distribution
    ? distribution.labels
    : Object.keys(data?.statusCounts || {});
  const values = distribution
    ? distribution.values
    : labels.map((k) => (data?.statusCounts ? data.statusCounts[k] : 0));
  const statusChartData = {
    labels,
    datasets: [
      {
        label: distribution ? "Distribution" : "Clients by Status",
        data: values,
        backgroundColor: labels.map(
          (_, i) => baseColors[i % baseColors.length],
        ),
        borderColor: labels.map(
          (_, i) => borderColors[i % borderColors.length],
        ),
        borderWidth: 1,
      },
    ],
  };

  const ChartComponent = {
    bar: Bar,
    pie: Pie,
    line: Line,
    radar: Radar,
    wave: WaveChart,
  }[type];

  const handleClick = (event: unknown) => {
    if (!onElementClick) return;
    const chart = chartRef.current as ChartClickRef | null;
    if (!chart) return;
    const nativeEvent = (event as { nativeEvent?: Event }).nativeEvent;
    if (!nativeEvent) return;
    const points = chart.getElementsAtEventForMode(
      nativeEvent,
      "nearest",
      { intersect: true },
      true,
    );
    if (points && points[0]) {
      const index = points[0].index;
      const label = labels[index];
      if (label) onElementClick(label);
    }
  };

  return (
    <ChartComponent
      ref={chartRef}
      data={statusChartData}
      options={options}
      onClick={handleClick}
    />
  );
}
