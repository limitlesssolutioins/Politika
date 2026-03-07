"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable, { type Column } from "@/components/DataTable";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Target, Plus, Trash2 } from "lucide-react";
import type { FilterOption } from "@/components/FilterPanel";

interface Objetivo {
  id: number;
  nivel: string;
  nivelId: number;
  partidoId: number;
  corporacionId: number;
  metaVotos: number;
  votosReales: number;
  cumplimiento: number;
  cumplido: boolean;
  partido: { id: number; nombre: string };
  corporacion: { id: number; nombre: string };
}

export default function ObjetivosPage() {
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [corporaciones, setCorporaciones] = useState<FilterOption[]>([]);
  const [partidos, setPartidos] = useState<FilterOption[]>([]);
  const [departamentos, setDepartamentos] = useState<FilterOption[]>([]);
  const [form, setForm] = useState({
    nivel: "departamento",
    nivelId: "",
    partidoId: "",
    corporacionId: "",
    metaVotos: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchObjetivos = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/objetivos");
    const data = await res.json();
    setObjetivos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchObjetivos();

    fetch("/api/estadisticas")
      .then((r) => r.json())
      .then((stats) => {
        setCorporaciones(
          stats.corporaciones.map((c: { id: number; nombre: string }) => ({
            value: String(c.id),
            label: c.nombre,
          }))
        );
        setPartidos(
          stats.topPartidos.map((p: { id: number; nombre: string }) => ({
            value: String(p.id),
            label: p.nombre,
          }))
        );
      });

    fetch("/api/geografia?nivel=departamentos")
      .then((r) => r.json())
      .then((deps: { id: number; nombre: string }[]) => {
        setDepartamentos(
          deps.map((d) => ({ value: String(d.id), label: d.nombre }))
        );
      });
  }, [fetchObjetivos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/objetivos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowForm(false);
    setForm({ nivel: "departamento", nivelId: "", partidoId: "", corporacionId: "", metaVotos: "" });
    fetchObjetivos();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/objetivos?id=${id}`, { method: "DELETE" });
    fetchObjetivos();
  };

  // Computed stats
  const totalObjetivos = objetivos.length;
  const cumplidos = objetivos.filter((o) => o.cumplido).length;
  const avgCumplimiento = totalObjetivos > 0
    ? Math.round(objetivos.reduce((acc, o) => acc + o.cumplimiento, 0) / totalObjetivos)
    : 0;

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "partido",
      header: "Partido",
      render: (row) => (row.partido as { nombre: string }).nombre,
    },
    {
      key: "corporacion",
      header: "Corporación",
      render: (row) => (row.corporacion as { nombre: string }).nombre,
    },
    { key: "nivel", header: "Nivel" },
    {
      key: "metaVotos",
      header: "Meta",
      align: "right",
      render: (row) => (row.metaVotos as number).toLocaleString("es-CO"),
    },
    {
      key: "votosReales",
      header: "Votos Reales",
      align: "right",
      render: (row) => (row.votosReales as number).toLocaleString("es-CO"),
    },
    {
      key: "cumplimiento",
      header: "Cumplimiento",
      align: "right",
      render: (row) => {
        const pct = row.cumplimiento as number;
        const color = pct >= 100 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
        return <span className={`font-semibold ${color}`}>{pct}%</span>;
      },
    },
    {
      key: "cumplido",
      header: "Estado",
      align: "center",
      render: (row) => {
        const cumplido = row.cumplido as boolean;
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            cumplido ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}>
            {cumplido ? "Cumplido" : "Pendiente"}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      align: "center",
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(row.id as number); }}
          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  const tableData = objetivos.map((o) => ({ ...o } as unknown as Record<string, unknown>));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target size={24} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Objetivos de Campaña</h1>
          </div>
          <p className="text-sm text-slate-500">Seguimiento de metas electorales vs. resultados reales</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Nuevo Objetivo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-sm text-slate-500">Total Objetivos</p>
          <p className="text-2xl font-bold text-slate-900">{totalObjetivos}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-sm text-slate-500">Cumplidos</p>
          <p className="text-2xl font-bold text-emerald-600">{cumplidos} / {totalObjetivos}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-sm text-slate-500">Cumplimiento Promedio</p>
          <p className={`text-2xl font-bold ${avgCumplimiento >= 100 ? "text-emerald-600" : avgCumplimiento >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {avgCumplimiento}%
          </p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Crear Objetivo</h3>
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nivel</label>
              <select
                value={form.nivel}
                onChange={(e) => setForm({ ...form, nivel: e.target.value, nivelId: "" })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="departamento">Departamento</option>
                <option value="municipio">Municipio</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                {form.nivel === "departamento" ? "Departamento" : "Municipio"}
              </label>
              <select
                value={form.nivelId}
                onChange={(e) => setForm({ ...form, nivelId: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[180px]"
                required
              >
                <option value="">Seleccionar...</option>
                {departamentos.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Partido</label>
              <select
                value={form.partidoId}
                onChange={(e) => setForm({ ...form, partidoId: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[180px]"
                required
              >
                <option value="">Seleccionar...</option>
                {partidos.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Corporación</label>
              <select
                value={form.corporacionId}
                onChange={(e) => setForm({ ...form, corporacionId: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[180px]"
                required
              >
                <option value="">Seleccionar...</option>
                {corporaciones.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Meta de Votos</label>
              <input
                type="number"
                value={form.metaVotos}
                onChange={(e) => setForm({ ...form, metaVotos: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-32"
                placeholder="0"
                required
                min="1"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : objetivos.length > 0 ? (
        <DataTable
          data={tableData}
          columns={columns}
          exportFileName="objetivos_campana"
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <Target size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-400">No hay objetivos configurados. Crea uno para comenzar el seguimiento.</p>
        </div>
      )}
    </div>
  );
}
