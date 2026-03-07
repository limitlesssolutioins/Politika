"use client";

import { useEffect, useState } from "react";
import StatsCard from "@/components/StatsCard";
import BarChartComponent from "@/components/charts/BarChartComponent";
import PieChartComponent from "@/components/charts/PieChartComponent";
import LoadingSpinner from "@/components/LoadingSpinner";
import { BarChart3, Vote, MapPin, Building2, Users } from "lucide-react";

interface Stats {
  totalMesas: number;
  totalVotos: number;
  totalDepartamentos: number;
  totalMunicipios: number;
  totalPuestos: number;
  corporaciones: { id: number; nombre: string; codigo: string; totalRegistros: number }[];
  topPartidos: { id: number; nombre: string; codigo: string; totalVotos: number }[];
  votosPorDepartamento: { id: number; nombre: string; totalVotos: number }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/estadisticas")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Cargando estadísticas..." />;
  if (!stats) return <p className="text-center text-slate-400 py-12">No hay datos disponibles. Ejecuta la importación primero.</p>;

  const topPartidosChart = stats.topPartidos.map((p) => ({
    name: p.nombre.length > 20 ? p.nombre.substring(0, 20) + "..." : p.nombre,
    value: p.totalVotos,
  }));

  const topDeptChart = stats.votosPorDepartamento.slice(0, 10).map((d) => ({
    name: d.nombre,
    value: d.totalVotos,
  }));

  const corpChart = stats.corporaciones.map((c) => ({
    name: c.nombre,
    value: c.totalRegistros,
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Polítika - Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Elecciones Colombia 2023 - Panorama General</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        <StatsCard title="Total Votos" value={stats.totalVotos} icon={Vote} color="blue" />
        <StatsCard title="Mesas" value={stats.totalMesas} icon={BarChart3} color="green" />
        <StatsCard title="Departamentos" value={stats.totalDepartamentos} icon={MapPin} color="purple" />
        <StatsCard title="Municipios" value={stats.totalMunicipios} icon={Building2} color="amber" />
        <StatsCard title="Puestos" value={stats.totalPuestos} icon={Users} color="red" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BarChartComponent
          data={topPartidosChart}
          title="Top 10 Partidos por Votos"
          colorful
          horizontal
          height={380}
        />
        <BarChartComponent
          data={topDeptChart}
          title="Top 10 Departamentos por Votos"
          color="#10b981"
          horizontal
          height={380}
        />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PieChartComponent
          data={corpChart}
          title="Registros por Corporación"
          height={320}
        />

        {/* Corporaciones table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Corporaciones</h3>
          <div className="space-y-3">
            {stats.corporaciones.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm font-medium text-slate-700">{c.nombre}</span>
                <span className="text-sm text-slate-500">{c.totalRegistros.toLocaleString("es-CO")} registros</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
