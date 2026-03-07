"use client";

import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "blue" | "green" | "red" | "purple" | "amber";
}

const colorMap = {
  blue: { bg: "bg-blue-50", text: "text-blue-600", icon: "bg-blue-100" },
  green: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "bg-emerald-100" },
  red: { bg: "bg-red-50", text: "text-red-600", icon: "bg-red-100" },
  purple: { bg: "bg-purple-50", text: "text-purple-600", icon: "bg-purple-100" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", icon: "bg-amber-100" },
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
}: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {typeof value === "number" ? value.toLocaleString("es-CO") : value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-lg p-2.5 ${colors.icon}`}>
          <Icon size={22} className={colors.text} />
        </div>
      </div>
    </div>
  );
}
