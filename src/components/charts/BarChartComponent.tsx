"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#0ea5e9", "#a855f7", "#d946ef",
];

interface BarChartProps {
  data: { name: string; value: number }[];
  title?: string;
  height?: number;
  color?: string;
  colorful?: boolean;
  horizontal?: boolean;
}

export default function BarChartComponent({
  data,
  title,
  height = 350,
  color = "#3b82f6",
  colorful = false,
  horizontal = false,
}: BarChartProps) {
  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 5, right: 20, left: horizontal ? 100 : 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          {horizontal ? (
            <>
              <XAxis type="number" tickFormatter={formatNumber} fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={11} width={95} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" fontSize={11} angle={-30} textAnchor="end" height={60} />
              <YAxis tickFormatter={formatNumber} fontSize={12} />
            </>
          )}
          <Tooltip
            formatter={(value) => [Number(value).toLocaleString("es-CO"), "Votos"]}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {colorful
              ? data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)
              : data.map((_, i) => <Cell key={i} fill={color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
