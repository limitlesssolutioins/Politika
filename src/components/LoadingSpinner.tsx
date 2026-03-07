"use client";

export default function LoadingSpinner({ text = "Cargando..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
      <p className="mt-3 text-sm text-slate-400">{text}</p>
    </div>
  );
}
