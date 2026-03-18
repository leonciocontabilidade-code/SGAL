export function StatsCard({ label, valor, cor, icone: Icone, sublabel }) {
  const cores = {
    verde: "bg-green-50 border-green-200 text-green-700",
    amarelo: "bg-yellow-50 border-yellow-200 text-yellow-700",
    vermelho: "bg-red-50 border-red-200 text-red-700",
    azul: "bg-blue-50 border-blue-200 text-blue-700",
    cinza: "bg-gray-50 border-gray-200 text-gray-600",
  };

  return (
    <div className={`rounded-xl border p-5 flex items-center gap-4 ${cores[cor] || cores.cinza}`}>
      {Icone && (
        <div className="p-2 rounded-lg bg-white/60">
          <Icone className="w-6 h-6" />
        </div>
      )}
      <div>
        <p className="text-3xl font-bold">{valor}</p>
        <p className="text-sm font-medium opacity-80">{label}</p>
        {sublabel && <p className="text-xs opacity-60 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}
